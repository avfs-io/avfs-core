# AVFS 地址双向转换规则

> 属于 [AVFS v1 规范](./avfs-v1-standard.md) — 原生路径/URL 与 AVFS 标准地址之间的无损转换。

## 1. 转换原则

所有转换遵循以下核心原则：

1. **无损往返**：`原生 → avfs → 原生` 产生完全相同的结果
2. **无数据丢失**：源地址的所有信息在目标格式中得以保留
3. **确定性**：相同输入始终产生相同输出
4. **可规范化**：输出符合规范化的 AVFS 语法规则

## 2. 本地路径 ↔ AVFS

### 2.1 本地路径 → AVFS（`toAvfs`）

**算法**：
1. 解析绝对路径（解析符号链接、`..`、`.`）
2. 前缀添加 `avfs://file/`
3. 将路径分隔符统一为 `/`

**示例**：

| 原生路径（Unix） | AVFS 地址 |
|------------------|-----------|
| `/home/user/config.json` | `avfs://file/home/user/config.json` |
| `d:/work/service/app.yaml` | `avfs://file/d/work/service/app.yaml` |
| `../../static/image.png` | `avfs://file/static/image.png` |
| `/opt/data/../report.pdf` | `avfs://file/opt/report.pdf` |

**边界情况**：

| 输入 | 处理方式 |
|------|----------|
| 相对路径 | 先相对于当前工作目录解析 |
| 符号链接 | 跟随符号链接，使用解析后的真实路径 |
| 含空格路径 | 原样保留（`file:` 无需编码） |
| 不存在的路径 | 仍然生成有效 AVFS 地址（无需实际存在） |
| 根路径 `/` | `avfs://file/`（空 file-path，表示根目录） |

### 2.2 AVFS → 本地路径（`toNative`）

**算法**：
1. 验证 `protocol === 'file'`
2. 移除 `avfs://file/` 前缀
3. 还原平台原生路径分隔符
4. 应用平台特定的根路径解析

**平台特定行为**：

| 平台 | 根路径解析 |
|------|-----------|
| Linux/macOS | `/` + 其余路径 |
| Windows | 驱动器号检测或当前工作目录相对 |

**示例**：

| AVFS 地址 | 原生路径（Linux） | 原生路径（Windows） |
|-----------|-------------------|---------------------|
| `avfs://file/home/user/doc.txt` | `/home/user/doc.txt` | `C:\home\user\doc.txt` |
| `avfs://file/d/work/bin.exe` | `/d/work/bin.exe` | `D:\work\bin.exe` |

---

## 3. HTTP/HTTPS URL ↔ AVFS

### 3.1 HTTP URL → AVFS（`toAvfs`）

**算法**：
1. 将 URL 解析为组成部分（scheme、host、port、path、query、fragment）
2. 确定 AVFS 协议：`http:` → `http`，`https:` → `https`
3. 构建 `resource-base`：`{host}[:{port}]`
4. 设置 `file-path`：URL pathname（去掉开头的 `/`）
5. 将 fragment 映射为 `#anchor`
6. 编码有意义的查询参数

**示例**：

| HTTP(S) URL | AVFS 地址 |
|-------------|-----------|
| `http://192.168.1.100:8080/api/data.csv` | `avfs://http/192.168.1.100:8080/api/data.csv` |
| `https://cdn.example.com/files/v1/package.zip` | `avfs://https/cdn.example.com/files/v1/package.zip` |
| `http://inner.server:9000/docs?ver=2#section1` | `avfs://http/inner.server:9000/docs?ver=2#section1` |

**边界情况**：

| 输入 | 处理方式 |
|------|----------|
| 含认证信息的 URL（`user:pass@host`） | 去除凭证（安全性）；详细模式下发出警告 |
| 含查询字符串的 URL | 原样保留在 file-path 或单独字段中 |
| URL 片段（`#`） | 直接映射到 AVFS `#anchor` |
| 默认端口（80/443） | 从 `resource-base` 中省略 |
| IPv6 地址 `[::1]` | 在 `resource-base` 中保留方括号 |

### 3.2 AVFS → HTTP URL（`toNative`）

**算法**：
1. 提取协议 → URL scheme（`http` → `http:`，`https` → `https:`）
2. 组合：`{scheme}//{resource-base}/{file-path}[#{anchor}]`
3. 如存在则重建查询字符串

**示例**：

| AVFS 地址 | HTTP(S) URL |
|-----------|------------|
| `avfs://http/192.168.3.20:8090/rule.yaml` | `http://192.168.3.20:8090/rule.yaml` |
| `avfs://https/avfs.io/spec/standard.pdf` | `https://avfs.io/spec/standard.pdf` |

---

## 4. SMB 路径 ↔ AVFS

### 4.1 SMB UNC 路径 → AVFS（`toAvfs`）

**SMB UNC 格式**：`\\{host}\{share}\{path}`

**算法**：
1. 从 UNC 中解析 host、share 和子路径
2. 构建 `resource-base`：`{host}/{share}`
3. 设置 `file-path`：share 内的子路径

**示例**：

| SMB UNC 路径 | AVFS 地址 |
|--------------|-----------|
| `\\192.168.1.60\share\docs\report.xlsx` | `avfs://smb/192.168.1.60/share/docs/report.xlsx` |
| `\\office.host\public\media\demo.mp4` | `avfs://smb/office.host/public/media/demo.mp4` |
| `\\server\data\..\archive\backup.tar.gz` | `avfs://smb/server/data/archive/backup.tar.gz``

**边界情况**：

| 输入 | 处理方式 |
|------|----------|
| IP 地址 | 原样使用 |
| DNS 主机名 | 原样使用（NetBIOS 或 FQDN） |
| 端口指定（`host:445`） | 非默认端口时包含在 `resource-base` 中 |
| 认证域（`DOMAIN\user`） | 存储在凭证中，从地址中剥离 |

### 4.2 AVFS → SMB 路径（`toNative`）

上述算法的反向操作。

---

## 5. Git 仓库 URL ↔ AVFS

### 5.1 Git URL → AVFS（`toAvfs`）

这是最复杂的转换，因为各平台的 URL 结构各异。

**支持的 Git 平台**：

| 平台 | 原生 Clone URL 模式 | 示例 |
|------|---------------------|------|
| GitHub | `https://github.com/{owner}/{repo}.git` | `github.com/avfs-io/core` |
| GitLab | `https://gitlab.com/{group}/{project}.git` | `gitlab.com/team/project` |
| Azure DevOps | `dev.azure.com/{org}/{_git}/{repo}` | `dev.azure.com/team/_git/service` |
| Bitbucket | `https://bitbucket.org/{team}/{repo}.git` | `bitbucket.org/team/runtime` |
| 自托管 Git | `https://{domain}/{path}/{repo}.git` | `git.company.internal/ai/group/engine` |
| SSH 风格 | `git@github.com:{owner}/{repo}.git` | 转换为 HTTPS 形式 |

**算法**：
1. 从 URL 结构检测平台类型
2. 提取各平台特有的组成部分（org、repo、project 等）
3. 构建 `resource-base` 并保留各平台原生层级结构
4. 如指定了分支/标签/提交则提取（→ `@version`）
5. 将 `file-path` 设为仓库内部路径

**GitHub 示例**：

| Git 上下文 | AVFS 地址 |
|-----------|-----------|
| `github.com/avfs-io/core`（默认分支） | `avfs://git/github.com/avfs-io/core/readme.md` |
| `github.com/avfs-io/core`，分支 `dev` | `avfs://git/github.com/avfs-io/core@dev/driver/smb.client` |
| `github.com/avfs-io/core`，标签 `v1.0.0` | `avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh` |
| `github.com/avfs-io/core`，提交 `9a27c1f` | `avfs://git/github.com/avfs-io/core@9a27c1f/module/kernel.so` |

**Azure DevOps 示例**：

| Git 上下文 | AVFS 地址 |
|-----------|-----------|
| Azure DevOps, org=`team`, project=`org`, repo=`service`, branch=`main` | `avfs://git/dev.azure.com/team/org/_git/service@main/src/entry.jar` |
| Azure DevOps, repo=`platform`, branch=`hotfix` | `avfs://git/dev.azure.com/team/org/_git/platform@hotfix/util/check.dll` |

**自托管 / Bitbucket 示例**：

| Git 上下文 | AVFS 地址 |
|-----------|-----------|
| 自托管 Git, branch=`release` | `avfs://git/git.company.internal/ai/group/engine@release/doc/design.vsdx` |
| Bitbucket, branch=`main` | `avfs://git/bitbucket.org/team/avfs-runtime@main/conf/env.ini` |

**版本锁定语义**：

| 版本类型 | 锁定行为 |
|---------|---------|
| 分支（如 `@main`、`@dev`） | 浮动的——始终指向该分支的最新提交 |
| 标签（如 `@v1.0.0`） | 不可变的——始终解析到同一个提交 |
| 提交哈希（如 `@9a27c1f`） | 不可变的——精确定位到特定修订版 |

### 5.2 AVFS → Git URL（`toNative`）

**算法**：
1. 提取 `protocol === 'git'`
2. 从 `resource-base` 结构中解析平台信息
3. 重建各平台特有的 clone URL
4. 提取版本信息用作 refspec
5. 推导工作树内的文件路径

**往返保证**：

```
native_git_url → avfs_address → reconstructed_git_url
```

重构后的 URL 在语法上可能不同，但必须解析到完全相同的仓库和修订版。

---

## 6. 自定义协议转换

对于用户自定义协议，转换采用可插拔策略：

### 6.1 实现自定义转换器

```typescript
import { registerConverter } from '@avfs/core';

const ossConverter: AddressConverter = {
  protocol: 'oss',

  toAvfs(nativePath: string): ParsedAddress {
    // 解析 OSS URI，如：oss://bucket-name/path/to/object
    const [, bucket, ...pathParts] = nativePath.match(/oss:\/\/([^\/]+)\/(.*)/) || [];
    return parseAddress(
      `avfs://oss/${bucket}/${pathParts.join('/')}`
    );
  },

  toNative(avfsAddr: ParsedAddress): string {
    // 重建 OSS URI
    return `oss://${avfsAddr.resourceBase}/${avfsAddr.filePath}`;
  }
};

registerConverter(ossConverter);
```

### 6.2 回退行为

如果某个协议没有注册自定义转换器：

- `toAvfs`：将原生路径包装为 `avfs://{protocol}/{native-path}`
- `toNative`：直接提取并返回 `{resource-base}/{filePath}`

---

## 7. 转换 API 参考

### 7.1 编程调用

```typescript
import { convertToAvfs, convertToNative } from '@avfs/core';

// 原生 → AVFS
const addr = convertToAVfs('/home/user/file.txt');
// → ParsedAddress { protocol: 'file', resourceBase: '', filePath: 'home/user/file.txt' }

// AVFS → 原生
const path = convertToNative('avfs://git/github.com/owner/repo@main/src/index.ts');
// → 平台相关的 git 引用字符串

// 带选项
const opts = { normalize: true, validate: true };
const addr2 = convertToAVfs(nativePath, opts);
```

### 7.2 CLI 使用

```bash
# 原生 → AVFS
avfs convert /home/user/config.json --to-avfs
# 输出: avfs://file/home/user/config.json

# AVFS → 原生
avfs convert "avfs://git/github.com/avfs-io/core@v1.0.0/readme.md" --to-native
# 输出: github.com/avfs-io/core (at tag v1.0.0), path: readme.md
```

### 7.3 批量转换

```bash
# 从文件转换多个路径
avfs convert --batch input-paths.txt --to-avfs --output converted-addrs.txt

# stdin 管道支持
cat urls.txt | avfs convert --from-format url --to-avfs
echo "avfs://file/data.bin" | avfs convert --to-native
```
