# FT-003 Code Research — cli-drivers 模块

> **扫描范围**：`cli/src/drivers/*` + `cli/test/drivers/*` + `cli/test/drivers.test.ts`
> **扫描日期**：2026-06-17
> **扫描类型**：只读探索

---

## 1. 代码库概述

### 模块用途

驱动模块（`cli/src/drivers/`）封装各协议的实际 I/O 操作，是 AVFS CLI 的核心数据访问层。当前包含 6 个源文件：1 个接口定义 + 1 个生产实现（GitDriver）+ 4 个桩实现（file/http/https/smb）。

### 文件清单

| 文件 | 行数 | 状态 | 说明 |
|------|:----:|------|------|
| `driver.interface.ts` | 62 | FT-001 简化版 | Driver 接口 + ConnectOptions + FileMetadata |
| `git.driver.ts` | 214 | ✅ 生产实现（FT-002） | GitHub REST API 驱动 |
| `file.driver.ts` | 26 | FT-001 桩 | 全部方法 throw "Not implemented" |
| `http.driver.ts` | 26 | FT-001 桩 | 同上 |
| `https.driver.ts` | 26 | FT-001 桩 | 同上 |
| `smb.driver.ts` | 26 | FT-001 桩 | 同上 |
| `test/drivers/git.driver.test.ts` | ~400 | ✅ 完整测试 | vitest + mock |
| `test/drivers.test.ts` | ~70 | 桩测试 | 验证 4 个桩 throw |

### 技术栈

- **运行时**：Node.js >= 20（`index.ts` L1-6 版本检查）
- **语言**：TypeScript 5.8，target ES2022，module NodeNext，strict 模式
- **构建**：tsup 8.5（ESM 输出 `dist/index.mjs`）
- **模块系统**：纯 ESM（`"type": "module"`，import 路径使用 `.js` 后缀）
- **运行时依赖**：仅 `commander ^14.0.0`（零额外依赖）
- **GitDriver 网络**：使用 Node.js 内置 `fetch()`（零依赖）

---

## 2. 现有实现分析

### A. Driver 接口（`driver.interface.ts`）

#### ConnectOptions（L4-9）

```typescript
export interface ConnectOptions {
  credentials?: Record<string, string>;
  timeout?: number;
}
```

#### FileMetadata（L14-23）

```typescript
export interface FileMetadata {
  size: number;
  mimeType: string;
  modifiedAt: Date;
  protocol: string;
}
```

仅 4 个字段，缺少 spec 中的 `name`/`path`/`contentType`/`lastModified`/`etag`/`checksum`/`permissions` 等。

#### Driver 接口（L32-61）

```typescript
export interface Driver {
  protocol: string;
  connect(resourceBase: string, options?: ConnectOptions): Promise<void>;
  read(filePath: string): Promise<ReadableStream<Uint8Array>>;
  stat(filePath: string): Promise<FileMetadata>;
  close(): Promise<void>;
}
```

**与 spec 的关键差异**：

| 维度 | 当前代码 | spec（driver-interface.md） | 差距 |
|------|----------|------|:----:|
| 元数据字段 | `protocol` 仅 1 个 | `protocol`/`version`/`displayName`/`description` 共 4 个 | 3 个缺失 |
| 生命周期 | 无 | `initialize(config)`/`destroy()` | 缺失 |
| connect 签名 | `connect(resourceBase: string, options?) → void` | `connect(address: ParsedAddress) → Connection` | 参数+返回类型不同 |
| stat 签名 | `stat(filePath: string) → FileMetadata` | `stat(address: ParsedAddress) → ResourceMetadata` | 参数+返回类型不同 |
| read 签名 | `read(filePath: string) → ReadableStream` | `read(address: ParsedAddress, options?: ReadOptions) → ReadableStream` | 缺 ReadOptions |
| 可选方法 | 无 | `list?`/`exists?`/`write?`/`delete?` | 缺失 |
| 错误类型 | plain `Error` | 9 种 `AVFSError` 子类 | 缺失 |
| 元数据模型 | `FileMetadata`（4 字段） | `ResourceMetadata`（11 字段） | 差距大 |

#### 错误处理

使用 **plain `Error`**，无自定义错误类。GitDriver 通过错误消息字符串分类（如 `"File not found: ..."`），无 `code` 属性。

---

### B. FileDriver（`file.driver.ts`）— 当前桩

```typescript
export class FileDriver implements Driver {
  readonly protocol = 'file';

  async connect(_resourceBase: string, _options?: ConnectOptions): Promise<void> {
    throw new Error('Not implemented');
  }
  async read(_filePath: string): Promise<ReadableStream<Uint8Array>> {
    throw new Error('Not implemented');
  }
  async stat(_filePath: string): Promise<FileMetadata> {
    throw new Error('Not implemented');
  }
  async close(): Promise<void> {
    throw new Error('Not implemented');
  }
}
```

**关键特征**：
- 所有方法 throw `new Error('Not implemented')`
- 未导入 `node:fs`/`node:path`/`node:stream`
- 无私有字段（不存储 resourceBase）
- 仅 `import type { Driver, ConnectOptions, FileMetadata }`

---

### C. GitDriver（`git.driver.ts`）— 生产参考实现

#### 类结构

```typescript
export class GitDriver implements Driver {
  readonly protocol = 'git';
  private owner = '';
  private repo = '';
  private version: string | null = null;
  // ...
}
```

#### connect（L77-82）

```typescript
async connect(resourceBase: string, options?: ConnectOptions): Promise<void> {
  const parsed = parseResourceBase(resourceBase);  // regex: /^github\.com\/([^/]+)\/([^/]+)$/
  this.owner = parsed.owner;
  this.repo = parsed.repo;
  this.version = options?.credentials?.['version'] ?? null;
}
```

- resourceBase 格式：`github.com/{owner}/{repo}`
- version 通过 `options.credentials['version']` 传递（hack 方式，非正式字段）
- 返回 `void`（非 Connection 对象）

#### stat（L98-115）

```typescript
async stat(filePath: string): Promise<FileMetadata> {
  this.ensureConnected();
  const url = buildContentsUrl(this.owner, this.repo, filePath, this.version);
  const response = await this.fetchWithTimeout(url, { headers: { Accept: 'application/vnd.github.v3+json' } });
  if (!response.ok) {
    throw new Error(classifyHttpError(response.status, filePath, this.owner, this.repo));
  }
  const json = await response.json();
  return {
    size: json.size ?? 0,
    mimeType: this.inferMimeType(json.name ?? filePath),
    modifiedAt: json.date ? new Date(json.date) : new Date(),
    protocol: 'git',
  };
}
```

- 使用 GitHub Contents API（JSON 响应）
- 返回 `FileMetadata`（4 字段），非 `ResourceMetadata`
- MIME 通过扩展名推断（`inferMimeType` 内置 22 种映射）

#### read（L125-136）

```typescript
async read(filePath: string): Promise<ReadableStream<Uint8Array>> {
  this.ensureConnected();
  const url = buildContentsUrl(this.owner, this.repo, filePath, this.version);
  const response = await this.fetchWithTimeout(url, { headers: { Accept: 'application/vnd.github.v3.raw' } });
  if (!response.ok) {
    throw new Error(classifyHttpError(response.status, filePath, this.owner, this.repo));
  }
  return response.body!;  // Web ReadableStream<Uint8Array>
}
```

- 使用 GitHub Contents API（raw 响应）
- 返回 Web Streams API 的 `ReadableStream<Uint8Array>`（非 Node.js `Readable`）
- `response.body` 直接返回，无需转换

#### close（L84-88）

```typescript
async close(): Promise<void> {
  this.owner = '';
  this.repo = '';
  this.version = null;
}
```

仅重置私有字段，无实际连接关闭（GitHub API 无状态）。

#### 错误分类（L41-50）

```typescript
function classifyHttpError(status: number, filePath: string, owner: string, repo: string): string {
  switch (status) {
    case 404: return `File not found: ${filePath} in ${owner}/${repo}`;
    case 403: return 'GitHub API rate limit exceeded. Try again later.';
    default: return `GitHub API request failed with status ${status}: ${filePath}`;
  }
}
```

通过 HTTP 状态码分类错误，但仍返回字符串消息，无错误类型区分。超时通过 `AbortController` 实现，抛出 `new Error('Network error: ... (timed out).')`。

#### fetchWithTimeout（L153-177）

- 使用 `AbortController` + `setTimeout`，默认 30 秒
- `AbortError` → 超时错误消息
- 其他网络错误 → 通用网络错误消息

#### inferMimeType（L183-213）

内置 22 种扩展名→MIME 映射表（`.md`/`.ts`/`.json`/`.png` 等），默认 `application/octet-stream`。**可复用于 FileDriver**。

---

### D. 桩驱动（http/https/smb）

三者结构完全一致，仅 `protocol` 属性不同（`'http'`/`'https'`/`'smb'`）。所有方法 throw `new Error('Not implemented')`。

---

### E. 驱动注册方式

**无注册表**。`fetch.command.ts` 直接 `import { GitDriver } from '../drivers/git.driver.js'` 然后 `new GitDriver()`。无 `DriverRegistry`、无 `registerDriver()`、无协议→驱动映射表。

---

### F. 测试模式（`git.driver.test.ts`）

- **框架**：vitest 3.2.4
- **Mock 策略**：`vi.stubGlobal('fetch', vi.fn())` 全局 mock fetch
- **测试结构**：`describe`/`it`/`expect`，按方法分组
- **覆盖场景**：connect 成功/失败、stat 404/403/成功、read 成功/失败、close、超时、MIME 推断
- **fixture**：内联 JSON 响应模拟 GitHub API

`drivers.test.ts`：验证 4 个桩驱动均 throw "Not implemented"。

---

## 3. 关键发现

### 3.1 接口升级影响面

升级 `Driver` → `AVFSDriver` 需要修改 **全部 6 个驱动文件**：
- `driver.interface.ts`：重写接口定义
- `git.driver.ts`：适配新签名（connect 返回 Connection、stat 返回 ResourceMetadata、参数改为 ParsedAddress、添加元数据字段和生命周期）
- `file.driver.ts`：从桩替换为完整实现
- `http/https/smb.driver.ts`：桩适配新接口（throw `NotImplementedError` 而非 plain Error）

### 3.2 GitDriver version 传递方式需改造

当前 version 通过 `options.credentials['version']` 传递（hack）。新接口使用 `ParsedAddress` 参数后，version 直接从 `address.version` 读取，`connect` 的 `options` 参数将移除。

### 3.3 inferMimeType 可复用

GitDriver 的 `inferMimeType` 方法应提取为共享工具函数，供 FileDriver 复用。

### 3.4 流类型一致性

所有驱动返回 Web Streams API 的 `ReadableStream<Uint8Array>`。FileDriver 需将 Node.js `fs.createReadStream`（Node Readable）转换为 Web ReadableStream，或直接使用 `Readable.toWeb()`。

### 3.5 ParsedAddress 字段差异

代码 `parser/types.ts` 的 `ParsedAddress` 与 spec 定义有差异（见 cli-commands 调研报告）。驱动接口升级需决定使用哪个定义。

---

## 4. 缺失项（FT-003 需新增）

| # | 缺失项 | 说明 |
|:-:|--------|------|
| 1 | `AVFSDriver` 接口 | 元数据字段 + 生命周期 + Connection + ParsedAddress 参数 + 可选方法 |
| 2 | `ResourceMetadata` 类型 | 11 字段标准化元数据模型 |
| 3 | `Connection` 类型 | 连接对象（id/createdAt/protocol/metadata/close/isOpen） |
| 4 | `Entry` 类型 | 目录列表条目（name/path/type/size/lastModified） |
| 5 | `ReadOptions`/`ListOptions`/`DriverConfig` 类型 | 选项类型 |
| 6 | `AVFSError` 错误体系 | 基类 + 5 种子类（DP4：NotFound/Permission/Timeout/Connection + NotImplemented） |
| 7 | FileDriver 完整实现 | initialize/destroy/connect/stat/read/list/exists |
| 8 | GitDriver 适配 | 全部方法签名改造 |
| 9 | 桩驱动适配 | throw NotImplementedError |
| 10 | 共享 MIME 推断工具 | 从 GitDriver 提取 |
| 11 | FileDriver 测试 | 新建 file.driver.test.ts |

---

## 5. 待确认问题

### Q1: ParsedAddress 使用代码版本还是 spec 版本？

代码版（`parser/types.ts`）有 `rawInput`/`isValid`/`errors`/`filePath: string|null`；spec 版有 `raw`/`query`/`filePath: string`。

**建议**：以代码版为基础（parser 已有完整实现和测试），在驱动接口中接受代码版 `ParsedAddress`。spec 文档后续更新对齐。

### Q2: Connection 对象对 FileDriver/GitDriver 的实际意义？

GitHub API 无状态，FileDriver 基于本地 fs 也无连接概念。Connection 可能只用于未来有状态驱动（SMB 会话、HTTP keep-alive）。

**建议**：FileDriver/GitDriver 返回轻量 Connection 对象（`isOpen` 总返回 true，`close` 为 no-op），满足接口契约不过度设计。

### Q3: FileDriver 的 read 返回类型？

`fs.createReadStream` 返回 Node.js `Readable`，需转为 `ReadableStream<Uint8Array>`。

**建议**：使用 `Readable.toWeb(nodeStream)` 转换，与 GitDriver 返回类型一致。

---

**调研完成日期**：2026-06-17
**调研人**：AI Agent (qahc-harness)
