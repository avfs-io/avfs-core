# FT-003 Code Research — docs-spec 模块

> **扫描范围**：`docs/contents/*/spec/driver-interface.md` + 相关规范 + `skills/avfs-skill/SKILL.md`
> **扫描日期**：2026-06-17
> **扫描类型**：只读探索

---

## 1. 文档概述

### 规范文件清单

| # | 文件路径 | 语言 | 行数 | 状态 |
|:-:|---------|:----:|:----:|------|
| 1 | `docs/contents/en-us/spec/driver-interface.md` | EN | 240 | **FT-003 主目标** |
| 2 | `docs/contents/zh-cn/spec/driver-interface.md` | ZH | 240 | 需同步 |
| 3 | `docs/contents/en-us/spec/address-syntax.md` | EN | 190 | FT-002 已更新 |
| 4 | `docs/contents/en-us/spec/avfs-v1-standard.md` | EN | 445 | FT-002 已更新 |
| 5 | `skills/avfs-skill/SKILL.md` | EN | 573 | FT-002 已更新 |

### 中英文同步状态

`driver-interface.md` 中英文版本内容**完全同步**——接口定义、类型定义、方法规范、错误类型、驱动注册示例逐一对应。

### 关键发现：driver-interface.md 未被 FT-002 更新

根据 FT-003 AskMe 文档明确标注：`docs/contents/*/spec/driver-interface.md` **❌ 待 FT-003 完成后更新**。FT-002 的文档更新工作覆盖了 12 个文件，但**故意跳过了** driver-interface.md。

---

## 2. AVFSDriver 接口规范（摘自 driver-interface.md §1）

### 2.1 完整接口定义（L10-31）

```typescript
interface AVFSDriver {
  // --- Metadata ---
  readonly protocol: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;

  // --- Lifecycle ---
  initialize(config: DriverConfig): Promise<void>;
  destroy(): Promise<void>;

  // --- Core Operations ---
  connect(address: ParsedAddress): Promise<Connection>;
  stat(address: ParsedAddress): Promise<ResourceMetadata>;
  read(address: ParsedAddress, options?: ReadOptions): Promise<ReadableStream<Uint8Array>>;
  list?(address: ParsedAddress, options?: ListOptions): Promise<Entry[]>;

  // --- Optional Capabilities ---
  exists?(address: ParsedAddress): Promise<boolean>;
  write?(address: ParsedAddress, data: ReadableStream<Uint8Array>): Promise<void>;
  delete?(address: ParsedAddress): Promise<void>;
}
```

### 2.2 元数据字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `protocol` | `string` (readonly) | 协议标识符 |
| `version` | `string` (readonly) | 驱动版本号 |
| `displayName` | `string` (readonly) | 人类可读名称 |
| `description` | `string` (readonly) | 驱动功能描述 |

---

## 3. 类型定义（§2）

### 3.1 ParsedAddress（spec 版，L40-49）

```typescript
interface ParsedAddress {
  raw: string;
  protocol: string;
  resourceBase: string;
  version?: string;
  filePath: string;
  anchor?: string;
  query?: Record<string, string>;
}
```

**与代码版（`parser/types.ts`）的差异**：

| 字段 | spec 版 | 代码版 | 差异 |
|------|---------|--------|------|
| 原始输入 | `raw: string` | `rawInput: string` | 字段名不同 |
| 版本 | `version?: string` | `version: string \| null` | optional vs null |
| 文件路径 | `filePath: string` | `filePath: string \| null` | 非空 vs 可空 |
| 锚点 | `anchor?: string` | `anchor: string \| null` | optional vs null |
| 查询参数 | `query?: Record<string, string>` | 无 | spec 独有 |
| 校验信息 | 无 | `isValid: boolean` + `errors: string[]` | 代码独有 |

**FT-003 对齐策略**：以代码版为准（parser 已有完整实现和测试），更新 spec 文档对齐代码版字段命名和可空性。

### 3.2 Connection（L56-64）

```typescript
interface Connection {
  id: string;
  createdAt: Date;
  protocol: string;
  metadata: Record<string, unknown>;
  close(): Promise<void>;
  isOpen(): boolean;
}
```

### 3.3 ResourceMetadata（L72-85）— 关键

```typescript
interface ResourceMetadata {
  name: string;
  path: string;
  size: number;              // Bytes
  mimeType: string;
  contentType: string;
  lastModified: Date;
  created?: Date;
  etag?: string;
  checksum?: string;         // SHA-256 hex digest
  version?: string;
  permissions?: string;      // Octal permission string (e.g., "0644")
  extra?: Record<string, unknown>;
}
```

**与代码版 `FileMetadata`（4 字段）的差异**：

| 字段 | FileMetadata（代码） | ResourceMetadata（spec） | 差距 |
|------|---------------------|------------------------|:----:|
| size | ✅ `size: number` | ✅ `size: number` | 一致 |
| mimeType | ✅ `mimeType: string` | ✅ `mimeType: string` | 一致 |
| 时间戳 | `modifiedAt: Date` | `lastModified: Date` + `created?: Date` | 字段名不同+新增 |
| 协议 | `protocol: string` | 无（移至 Connection） | 代码独有 |
| name | 无 | `name: string` | 新增 |
| path | 无 | `path: string` | 新增 |
| contentType | 无 | `contentType: string` | 新增 |
| etag | 无 | `etag?: string` | 新增 |
| checksum | 无 | `checksum?: string` | 新增 |
| version | 无 | `version?: string` | 新增 |
| permissions | 无 | `permissions?: string` | 新增 |
| extra | 无 | `extra?: Record<string, unknown>` | 新增 |

### 3.4 Entry（L93-99）

```typescript
interface Entry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size?: number;
  lastModified?: Date;
}
```

### 3.5 Options 类型（L104-123）

```typescript
interface ReadOptions {
  offset?: number;
  length?: number;
  encoding?: BufferEncoding;
}

interface ListOptions {
  recursive?: boolean;
  maxDepth?: number;
  filter?: (entry: Entry) => boolean;
}

interface DriverConfig {
  credentials?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  cachePolicy?: 'none' | 'metadata' | 'full';
  customOptions?: Record<string, unknown>;
}
```

---

## 4. 标准化错误类型（§4，L197-211）

### 4.1 spec 定义的 9 种错误类型

```typescript
class AVFSError extends Error {
  constructor(message: string, public code: string, public cause?: Error);
}

class NotFoundError extends AVFSError { code = 'NOT_FOUND'; }
class AuthenticationError extends AVFSError { code = 'AUTH_FAILED'; }
class PermissionError extends AVFSError { code = 'FORBIDDEN'; }
class ConnectionError extends AVFSError { code = 'CONNECTION_ERROR'; }
class ReadError extends AVFSError { code = 'READ_ERROR'; }
class TimeoutError extends AVFSError { code = 'TIMEOUT'; }
class InvalidAddressError extends AVFSError { code = 'INVALID_ADDRESS'; }
class DriverInitError extends AVFSError { code = 'DRIVER_INIT_ERROR'; }
class NotImplementedError extends AVFSError { code = 'NOT_IMPLEMENTED'; }
```

### 4.2 DP4 决策：实现 4+1 种

根据 AskMe DP4 决策，FT-003 实现 **5 种**错误类型（4 核心 + 1 NotImplemented）：

| 错误类 | code | 使用场景 | FT-003 实现 |
|--------|------|----------|:-----------:|
| `NotFoundError` | `NOT_FOUND` | 文件/资源不存在 | ✅ |
| `PermissionError` | `FORBIDDEN` | 权限不足 | ✅ |
| `TimeoutError` | `TIMEOUT` | 网络/IO 超时 | ✅ |
| `ConnectionError` | `CONNECTION_ERROR` | 连接失败 | ✅ |
| `NotImplementedError` | `NOT_IMPLEMENTED` | 方法未实现（stub 驱动） | ✅ |
| `AuthenticationError` | `AUTH_FAILED` | 认证失败 | ❌ 后续追加 |
| `ReadError` | `READ_ERROR` | 读取 I/O 失败 | ❌ 后续追加 |
| `InvalidAddressError` | `INVALID_ADDRESS` | 地址格式错误 | ❌ 后续追加 |
| `DriverInitError` | `DRIVER_INIT_ERROR` | 初始化失败 | ❌ 后续追加 |

**文档对齐策略**：spec 中保留全部 9 种定义（作为完整规范），但标注当前已实现 5 种。或在 spec 中标注"当前实现 5 种，其余增量追加"。

---

## 5. 方法规范（§3）

### 5.1 initialize（L128-136）
- 验证配置参数、建立持久连接
- 失败抛 `DriverInitError`
- 必须幂等

### 5.2 destroy（L138-146）
- 关闭连接、释放缓存、使认证会话失效
- 必须安全支持多次调用

### 5.3 connect（L148-158）
- 执行认证、验证资源可访问性
- 返回 `Connection` 对象
- 抛 `AuthenticationError`/`ConnectionError`/`NotFoundError`

### 5.4 stat（L160-168）
- 返回完整 `ResourceMetadata`
- `size` 必须准确
- `mimeType` 通过头嗅探 + 后缀匹配
- 资源不存在抛 `NotFoundError`

### 5.5 read（L170-181）
- 返回 `ReadableStream<Uint8Array>`（原始二进制流）
- 支持 `offset`/`length` 范围读取
- 不修改原始数据
- 流错误使用 `ReadError`/`PermissionError`/`TimeoutError`

### 5.6 list（L183-191，可选）
- 目录遍历
- 尊重 `recursive`/`maxDepth`/`filter`
- 条目按名称字母序排列（目录优先）

---

## 6. file 协议规范细节

driver-interface.md 中未单独描述 file 协议的路径映射规则。file 协议的行为分散在：
- `address-syntax.md`：定义 `avfs://file/<resourceBase>/<filePath>` 格式
- `avfs-v1-standard.md` §2.1.1：内置驱动映射表（file → LocalFileDriver，POSIX I/O）

**路径映射规则**（从 address-syntax.md 推断）：
- `avfs://file/home/user/docs/report.pdf`
- `resourceBase` = `/home/user/docs`（绝对路径前缀）
- `filePath` = `report.pdf`
- 组合为：`path.join(resourceBase, filePath)` = `/home/user/docs/report.pdf`

**跨平台**：spec 中标注 file 驱动为 "POSIX I/O"，未明确提及 Windows 支持。FT-003 需更新为"Node.js fs 模块（跨平台）"。

**安全边界**：spec 未提及路径遍历限制。DP5 决策为不限制（允许 `../`）。

---

## 7. 关键发现与差距

### 7.1 代码→spec 对齐项（代码已实现，spec 需更新）

| # | 差距项 | 当前 spec | 应更新为 | 理由 |
|:-:|--------|-----------|----------|------|
| 1 | ParsedAddress 字段名 | `raw`/`filePath: string`/`anchor?` | `rawInput`/`filePath: string\|null`/`anchor: string\|null` | 对齐代码版（parser 已有完整实现） |
| 2 | ParsedAddress 校验字段 | 无 | 新增 `isValid: boolean` + `errors: string[]` | 代码版独有，实用性强 |
| 3 | file 驱动描述 | "POSIX I/O" | "Node.js fs 模块（跨平台）" | DP5 + 跨平台场景 |
| 4 | 错误类型实现状态 | 列出 9 种 | 标注当前实现 5 种 | DP4 决策 |

### 7.2 spec→代码 对齐项（spec 已定义，代码需实现）

| # | 差距项 | spec 定义 | 代码现状 | FT-003 动作 |
|:-:|--------|-----------|----------|:-----------:|
| 1 | AVFSDriver 接口 | 完整接口 | 简化 4 方法 | 升级代码 |
| 2 | ResourceMetadata | 11 字段 | FileMetadata 4 字段 | 升级代码 |
| 3 | Connection 类型 | 完整定义 | 无 | 新增代码 |
| 4 | Entry 类型 | 完整定义 | 无 | 新增代码 |
| 5 | 标准化错误 | 9 种（实现 5 种） | plain Error | 新增代码 |
| 6 | 生命周期方法 | initialize/destroy | 无 | 新增代码 |
| 7 | 可选方法 | list/exists | 无 | 新增代码（DP2） |

### 7.3 SKILL.md 影响

`skills/avfs-skill/SKILL.md` 引用了 `avfs stat` 和 `avfs fetch` 命令。FT-003 改变了 stat 的输出格式（ParsedAddress → ResourceMetadata），SKILL.md 中如有 stat 输出示例需同步更新。

---

## 8. 待确认问题

### Q1: spec 中的 ParsedAddress 是否完全对齐代码版？

spec 版有 `query?: Record<string, string>` 字段，代码版没有。FT-002 使用 `?ref=` 查询参数语法，但 parser 将 `ref` 值直接放入 `version` 字段，不保留原始 query 对象。

**建议**：spec 删除 `query?` 字段（代码不实现），或代码新增 `query?` 字段。倾向删除以保持精简。

### Q2: ResourceMetadata 中 `protocol` 字段是否需要？

代码版 `FileMetadata` 有 `protocol` 字段，spec 版 `ResourceMetadata` 没有（protocol 移到了 Connection 中）。但 CLI 输出 ResourceMetadata 时，用户可能需要知道来源协议。

**建议**：在 `extra` 字段中放入 `protocol`，或直接在 ResourceMetadata 新增 `protocol?: string` 字段。

### Q3: spec 中错误类型是否标注实现状态？

spec 列出 9 种错误类型，DP4 决策只实现 5 种。

**建议**：spec 保留 9 种定义（完整规范），在 §4 添加注释说明"当前实现 5 种核心类型，其余增量追加"。

---

**调研完成日期**：2026-06-17
**调研人**：AI Agent (qahc-harness)
