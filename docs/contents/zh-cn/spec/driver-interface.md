# AVFS 驱动插件接口契约

> 属于 [AVFS v1 规范](./avfs-v1-standard.md) — 官方驱动插件接口规范与 API 参考。

## 1. 接口概述

每个 AVFS 协议驱动必须实现 `AVFSDriver` 接口。此契约定义了核心运行时为满足智能体请求所调用的方法。

```typescript
interface AVFSDriver {
  // --- 元数据 ---
  readonly protocol: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;

  // --- 生命周期 ---
  initialize(config: DriverConfig): Promise<void>;
  destroy(): Promise<void>;

  // --- 核心操作 ---
  connect(address: ParsedAddress): Promise<Connection>;
  stat(address: ParsedAddress): Promise<ResourceMetadata>;
  read(address: ParsedAddress, options?: ReadOptions): Promise<ReadableStream<Uint8Array>>;
  list?(address: ParsedAddress, options?: ListOptions): Promise<Entry[]>;

  // --- 可选能力 ---
  exists?(address: ParsedAddress): Promise<boolean>;
  write?(address: ParsedAddress, data: ReadableStream<Uint8Array>): Promise<void>;
  delete?(address: ParsedAddress): Promise<void>;
}
```

## 2. 类型定义

### 2.1 ParsedAddress

表示经过完整解析和验证的 AVFS 地址。

```typescript
interface ParsedAddress {
  raw: string;           // 原始地址字符串
  protocol: string;      // 小写协议标识符
  resourceBase: string;  // 基础资源定位符
  version?: string;      // 版本限定符（仅 Git）
  filePath: string;      // 规范化内部文件路径
  anchor?: string;       // 内容位置标记
  query?: Record<string, string>; // 可选查询参数
}
```

### 2.2 Connection

表示到底层资源的活动连接。

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

### 2.3 ResourceMetadata

任何可访问资源返回的标准元数据。

```typescript
interface ResourceMetadata {
  name: string;
  path: string;
  size: number;              // 字节数
  mimeType: string;
  contentType: string;
  lastModified: Date;
  created?: Date;
  etag?: string;
  checksum?: string;          // SHA-16 十六进制摘要
  version?: string;           // 如适用的源码管理版本
  permissions?: string;       // 八进制权限字符串（如 "0644"）
  extra?: Record<string, unknown>; // 驱动专属扩展字段
}
```

### 2.4 Entry

目录列表条目。

```typescript
interface Entry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size?: number;
  lastModified?: Date;
}
```

### 2.5 Options

```typescript
interface ReadOptions {
  offset?: number;       // 范围读取的字节偏移量
  length?: number;       // 要读取的字节数
  encoding?: BufferEncoding; // 用于文本模式（默认：null/二进制）
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

## 3. 方法规范

### 3.1 `initialize(config)`

驱动注册并加载到运行时时调用一次。

**要求**：
- 验证配置参数
- 建立持久连接（连接池、认证会话）
- 若初始化失败且无法恢复则抛出 `DriverInitError`
- 必须幂等——多次调用无额外效果

### 3.2 `destroy()`

清理该驱动实例持有的所有资源。

**要求**：
- 关闭所有打开的连接
- 释放缓存数据
- 使认证会话失效
- 必须安全支持多次调用

### 3.3 `connect(address)`

建立到目标资源的逻辑连接。

**要求**：
- 必要时执行认证
- 验证资源可访问性
- 返回代表会话的 `Connection` 对象
- 凭证问题抛出 `AuthenticationError`
- 网络/可用性失败抛出 `ConnectionError`
- 资源不存在抛出 `NotFoundError`

### 3.4 `stat(address)`

返回资源的元数据而不读取其内容。

**要求**：
- 返回完整的 `ResourceMetadata` 对象
- `size` 必须准确（字节计数）
- `mimeType` 应通过头嗅探 + 后缀匹配确定
- 资源不存在时抛出 `NotFoundError`

### 3.5 `read(address, options?)`

读取资源的原始二进制内容。

**要求**：
- 始终返回原始二进制流 (`ReadableStream<Uint8Array>`)
- 当指定了 `offset`/`length` 时支持范围读取
- 永不修改或转换原始字节数据
- 流错误应使用标准错误类型：
  - I/O 故障用 `ReadError`
  - 授权失败用 `PermissionError`
  - 缓慢/无响应资源用 `TimeoutError`

### 3.6 `list(address, options?)` *（可选）*

列出目录资源的内容。

**要求**：
- 仅当驱动支持目录遍历时需要
- 遵守 `recursive` 和 `maxDepth` 选项
- 如提供了 `filter` 函数则应用之
- 返回按名称字母排序的结果（目录优先）

## 4. 错误类型

所有驱动必须使用标准化错误类型：

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

## 5. 驱动注册

驱动使用以下模式进行自注册：

```typescript
import { registerDriver } from '@avfs/core';

class MyCustomDriver implements AVFSDriver {
  readonly protocol = 'my-custom';
  readonly version = '1.0.0';
  readonly displayName = '我的自定义存储';
  readonly description = '访问我的自定义存储服务';

  async initialize(config: DriverConfig): Promise<void> { /* ... */ }
  async destroy(): Promise<void> { /* ... */ }
  async connect(addr: ParsedAddress): Promise<Connection> { /* ... */ }
  async stat(addr: ParsedAddress): Promise<ResourceMetadata> { /* ... */ }
  async read(addr: ParsedAddress, opts?: ReadOptions): Promise<ReadableStream<Uint8Array>> { /* ... */ }
}

// 注册到运行时
registerDriver(new MyCustomDriver());
```

## 6. 内置驱动参考

参见主规范 [第 2.1.1 节](./avfs-v1-standard.md#211-内置官方协议与驱动-mapping)中的官方内置驱动及其协议标识列表。
