# AVFS 认证规范

> [AVFS v1 标准](./avfs-v1-standard.md) 的一部分 — 面向协议-驱动插件架构的凭据管理与认证模型。

## 1. 设计原则

AVFS 采用**凭据路由与认证执行分离**的机制，利用协议-驱动架构：

| 层 | 职责 | 不做 |
|----|------|------|
| **Core（凭据存储）** | 存储、解析、将凭据路由到正确的驱动 | 执行认证；理解驱动特有的认证协议 |
| **Driver（驱动）** | 消费凭据并对目标后端执行认证 | 知道凭据从哪里来；管理凭据生命周期 |

这保证了：
- 驱动负责**如何**认证（token、密码、证书、OAuth 等）
- Core 负责**哪个**凭据适用于**哪个**资源
- Agent 提供或配置凭据，而不耦合到任何特定传输层

## 2. 核心架构

```
Agent / 用户 / Secret Manager
        │
        ▼
┌───────────────────────────────────────────┐
│           凭据存储（Core）                  │
│                                            │
│  解析 (protocol, resourceBase) → 凭据      │
│  来源：环境变量、文件、Vault、Agent 覆盖    │
└──────────────────┬────────────────────────┘
                   │ DriverConfig { credentials }
                   ▼
┌───────────────────────────────────────────┐
│              驱动（如 git）                 │
│  使用 creds.token → GitHub API 认证        │
│  使用 creds.user/pass → SMB 登录           │
│  每个驱动独立的认证逻辑                      │
└───────────────────────────────────────────┘
```

## 3. 凭据存储接口

`CredentialStore` 是 Core 提供的服务，为每个请求解析凭据。

```typescript
interface CredentialStore {
  /**
   * 为给定的协议和资源基址解析凭据。
   * 返回 null 表示无凭据配置（匿名访问）。
   */
  resolve(protocol: string, resourceBase: string): Promise<Record<string, string> | null>;

  /**
   * 为精确的 (protocol, resourceBase) 对注册凭据。
   */
  set(protocol: string, resourceBase: string, credentials: Record<string, string>): Promise<void>;

  /**
   * 使用模式注册凭据。
   * 支持通配符匹配："git/github.com/*" 匹配所有 GitHub 仓库。
   */
  setPattern(pattern: string, credentials: Record<string, string>): Promise<void>;

  /**
   * 移除指定范围的凭据。
   */
  remove(protocol: string, resourceBase: string): Promise<void>;

  /**
   * 从外部后端加载凭据。
   */
  loadBackend(type: 'env' | 'file' | 'vault' | 'agent', config: Record<string, unknown>): Promise<void>;

  /**
   * 列出所有已注册的凭据范围（不含密钥值）。
   */
  listScopes(): Promise<CredentialScope[]>;
}

interface CredentialScope {
  protocol: string;
  resourceBase: string;
  isPattern: boolean;
  source: 'env' | 'file' | 'vault' | 'agent' | 'manual';
}
```

## 4. 凭据解析

### 4.1 匹配算法

当请求到达 `avfs://<protocol>/<resourceBase>/<path>` 时，Core 按以下方式解析凭据：

1. **精确匹配** — 在存储中查找 `(protocol, resourceBase)`
2. **模式匹配** — 若无精确匹配，遍历已注册模式（最具体优先）
3. **默认** — 仍无匹配，返回 `null`（匿名访问）

```typescript
function resolveCredentials(store: CredentialStore, protocol: string, resourceBase: string) {
  // 1. 精确匹配
  let creds = await store.resolve(protocol, resourceBase);
  if (creds) return creds;

  // 2. 模式匹配（最长前缀优先）
  const patterns = store.listPatterns(protocol);
  patterns.sort((a, b) => b.pattern.length - a.pattern.length);
  for (const p of patterns) {
    if (matchPattern(resourceBase, p.pattern)) {
      return store.resolve(protocol, p.pattern);
    }
  }

  // 3. 匿名
  return null;
}
```

### 4.2 模式语法

| 模式 | 匹配范围 |
|------|----------|
| `*` | 该协议下的所有资源 |
| `github.com/*` | github.com 上的所有资源 |
| `github.com/avfs-io/*` | avfs-io 组织下的所有仓库 |
| `*.internal` | 所有 *.internal 主机上的资源 |

### 4.3 示例

**配置：**

```typescript
store.set('git', 'github.com/*', { token: 'ghp_xxx' });
store.set('smb', 'fileserver.internal', { username: 'admin', password: 's3cret' });
store.set('https', 'api.private.io', { cert: '/path/to/cert.pem', key: '/path/to/key.pem' });
```

**解析结果：**

| 请求地址 | 解析出的凭据 |
|----------|-------------|
| `avfs://git/github.com/avfs-io/core/readme.md` | `{ token: 'ghp_xxx' }` |
| `avfs://git/gitlab.com/other/repo/file.go` | `null`（无匹配） |
| `avfs://smb/fileserver.internal/share/doc.pdf` | `{ username: 'admin', password: 's3cret' }` |
| `avfs://smb/other.server/share/x.txt` | `null`（无匹配） |
| `avfs://https/api.private.io/data` | `{ cert: '...', key: '...' }` |

## 5. 凭据来源与优先级

凭据可来自多个来源。当多个来源为同一范围提供凭据时，按以下优先级应用（最高优先）：

| 优先级 | 来源 | 使用场景 |
|--------|------|----------|
| 1（最高） | **Agent 覆盖** | Agent 为特定请求显式传入凭据 |
| 2 | **Vault / Secret Manager** | 企业部署（HashiCorp Vault、AWS Secrets Manager 等） |
| 3 | **配置文件** | `~/.avfs/credentials.json` — 用户本地或项目本地 |
| 4 | **环境变量** | CI/CD 流水线、容器化环境 |
| 5（最低） | **匿名 / 公开** | 无需认证的公开资源 |

### 5.1 环境变量

```bash
# 按协议、按资源
export AVFS_CRED_GIT_GITHUB_COM_TOKEN="ghp_xxx"
export AVFS_CRED_SMB_FILESERVER_USER="admin"
export AVFS_CRED_SMB_FILESERVER_PASS="s3cret"

# 通配
export AVFS_CRED_GIT_ALL_TOKEN="glpat-xxx"  # AVFS_CRED_<PROTO>_ALL_<KEY>
```

### 5.2 配置文件 (`~/.avfs/credentials.json`)

```json
{
  "credentials": [
    {
      "protocol": "git",
      "resourceBase": "github.com/*",
      "values": { "token": "ghp_xxx" }
    },
    {
      "protocol": "smb",
      "resourceBase": "fileserver.internal",
      "values": { "username": "admin", "password": "s3cret" }
    },
    {
      "protocol": "https",
      "resourceBase": "*.private.io",
      "values": { "certFile": "/etc/avfs/certs/client.pem", "keyFile": "/etc/avfs/certs/client.key" }
    }
  ]
}
```

### 5.3 Agent 覆盖

Agent 可在请求时提供凭据，具有最高优先级：

```typescript
const result = await avfs.read('avfs://git/github.com/team/repo/config.yaml?ref=main', {
  credentials: { token: 'ghp_one-time-token' }  // ← 覆盖所有其他来源
});
```

## 6. 驱动的认证角色

### 6.1 契约

每个驱动**必须**：
- 从 `this.config.credentials` 读取凭据（由 Core 在 `connect()` 前填充）
- 执行自己的认证逻辑（Core 永不知道驱动如何认证）
- 认证失败时抛出 `AuthenticationError`
- 优雅处理凭据缺失（尝试匿名访问或抛出 `AuthenticationError`）

每个驱动**不得**：
- 硬编码凭据来源（环境变量、文件等）
- 将凭据泄漏到日志、错误信息或其他驱动
- 跨不同资源基址共享凭据（除非显式配置）

### 6.2 示例：Git 驱动

```typescript
class GitDriver implements AVFSDriver {
  readonly protocol = 'git';

  async connect(address: ParsedAddress): Promise<Connection> {
    const token = this.config.credentials?.token;
    const client = token
      ? new GitClient({ auth: `Bearer ${token}` })
      : new GitClient(); // 匿名

    await client.ping(address.resourceBase); // 401 时抛出 AuthenticationError
    return new GitConnection(client, address);
  }
}
```

### 6.3 示例：SMB 驱动

```typescript
class SMBDriver implements AVFSDriver {
  readonly protocol = 'smb';

  async connect(address: ParsedAddress): Promise<Connection> {
    const { username, password } = this.config.credentials ?? {};
    if (!username) throw new AuthenticationError('SMB 需要用户名');

    const session = await smbClient.connect(address.resourceBase, { username, password });
    return new SMBConnection(session);
  }
}
```

### 6.4 示例：自定义驱动（mTLS）

```typescript
class MutualTLSDriver implements AVFSDriver {
  readonly protocol = 'mtls';

  async connect(address: ParsedAddress): Promise<Connection> {
    const { cert, key, ca } = this.config.credentials ?? {};
    const httpsAgent = new Agent({ cert, key, ca, rejectUnauthorized: true });
    const response = await fetch(`https://${address.resourceBase}/${address.filePath}`, { agent: httpsAgent });
    if (response.status === 401) throw new AuthenticationError('mTLS 握手失败');
    // ...
  }
}
```

## 7. 安全要求

### 7.1 凭据隔离

为一个驱动注册的凭据**不得**被任何其他驱动访问。Core 在凭据存储层面强制执行：

```typescript
// Core 仅将凭据传递给匹配的驱动
const creds = store.resolve(protocol, resourceBase);
const config: DriverConfig = { credentials: creds ?? undefined };
await driver.initialize(config); // ← 仅此驱动可见这些凭据
```

### 7.2 脱敏

- 凭据值**不得**出现在日志、错误信息或事件负载中
- 错误信息必须使用通用描述：`"github.com 认证失败"` — 绝不能是 `"Token ghp_xxx 无效"`
- 调试/追踪模式必须对凭据字段进行脱敏处理

### 7.3 存储加密

- 基于文件的凭据存储（`~/.avfs/credentials.json`）**应**支持静态加密
- 内存中的凭据**应**在平台能力允许的情况下保存在隔离的内存区域
- 从环境变量加载的凭据**应**在加载后从进程环境中清除

### 7.4 传输安全

- 通过网络传输凭据的驱动**应**使用加密通道（TLS 1.2+）
- 凭据**不得**作为 URL 查询参数传输
- `https` 驱动**必须**默认验证 TLS 证书（开发环境可配置关闭）

## 8. 错误处理

所有认证相关错误使用 [驱动接口](./driver-interface.md#4-错误类型) 中定义的标准 `AuthenticationError` 类型。

```typescript
class AuthenticationError extends AVFSError {
  code = 'AUTH_FAILED';
}

// 驱动用法：
throw new AuthenticationError(`${address.resourceBase} 认证失败`);
```

Core 捕获驱动的 `AuthenticationError` 后可以：
1. 将错误返回给调用方（Agent）
2. 若配置了刷新回调，触发凭据刷新
3. 若存在多个匹配的凭据集，尝试下一个

## 9. 凭据生命周期

### 9.1 注册

凭据在以下时机加载：
- 运行时启动时（从配置文件和 env 加载）
- Agent 调用 `store.set()` 或 `store.setPattern()` 时
- 通过 `store.loadBackend()` 加载后端时

### 9.2 刷新

驱动可以指示凭据需要轮换：

```typescript
interface DriverConfig {
  credentials?: Record<string, string>;
  onCredentialsExpired?: (protocol: string, resourceBase: string) => Promise<Record<string, string>>;
}
```

当驱动抛出带有过期提示的 `AuthenticationError` 时，Core 调用 `onCredentialsExpired` 获取新凭据并重试一次。

### 9.3 撤销

凭据可通过以下方式移除：
- `store.remove(protocol, resourceBase)` — 编程式移除
- `avfs credential revoke <protocol> <resourceBase>` — CLI 命令
- 基于 TTL 的自动过期（如果为凭据条目配置了 TTL）

## 10. CLI 命令

```bash
# 设置凭据
avfs credential set git github.com --token "ghp_xxx"
avfs credential set smb fileserver.internal --username admin --password "s3cret"

# 列出已配置的凭据范围（密钥隐藏）
avfs credential list

# 移除凭据
avfs credential revoke git github.com

# 从文件加载
avfs credential load --file ~/.avfs/credentials.json
```
