# AVFS Driver Plugin Interface Contract

> Part of [AVFS v1 Standard](./avfs-v1-standard.md) — Official driver plugin interface specification and API reference.

## 1. Interface Overview

Every AVFS protocol driver must implement the `AVFSDriver` interface. This contract defines the methods that the core runtime calls to fulfill agent requests.

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

## 2. Type Definitions

### 2.1 ParsedAddress

Represents a fully parsed and validated AVFS address.

```typescript
interface ParsedAddress {
  raw: string;           // Original address string
  protocol: string;      // Lowercase protocol identifier
  resourceBase: string;  // Base resource locator
  version?: string;      // Version qualifier (Git only)
  filePath: string;      // Normalized internal file path
  anchor?: string;       // Content position marker
  query?: Record<string, string>; // Optional query parameters
}
```

### 2.2 Connection

Represents an active connection to the underlying resource.

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

Standardized metadata returned for any accessible resource.

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
  checksum?: string;          // SHA-256 hex digest
  version?: string;           // Source control version if applicable
  permissions?: string;       // Octal permission string (e.g., "0644")
  extra?: Record<string, unknown>; // Driver-specific extensions
}
```

### 2.4 Entry

Directory listing entry.

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
  offset?: number;       // Byte offset for range reads
  length?: number;       // Number of bytes to read
  encoding?: BufferEncoding; // For text mode (default: null/binary)
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

## 3. Method Specifications

### 3.1 `initialize(config)`

Called once when the driver is registered and loaded into the runtime.

**Requirements**:
- Validate configuration parameters
- Establish any persistent connections (connection pools, auth sessions)
- Throw `DriverInitError` if initialization fails irrecoverably
- Must be idempotent — calling multiple times has no additional effect

### 3.2 `destroy()`

Clean up all resources held by this driver instance.

**Requirements**:
- Close all open connections
- Release cached data
- Invalidate authentication sessions
- Must be safe to call multiple times

### 3.3 `connect(address)`

Establish a logical connection to the target resource.

**Requirements**:
- Perform authentication if required
- Verify resource accessibility
- Return a `Connection` object representing the session
- Throw `AuthenticationError` for credential issues
- Throw `ConnectionError` for network/availability failures
- Throw `NotFoundError` if the resource does not exist

### 3.4 `stat(address)`

Return metadata about the resource without reading its content.

**Requirements**:
- Return complete `ResourceMetadata` object
- `size` must be accurate (byte count)
- `mimeType` should be determined via header sniffing + extension matching
- Throw `NotFoundError` if resource does not exist

### 3.5 `read(address, options?)`

Read the raw binary content of the resource.

**Requirements**:
- Always return raw binary stream (`ReadableStream<Uint8Array>`)
- Support range reads when `offset`/`length` are specified
- Never modify or transform the original byte data
- Stream errors should use standard error types:
  - `ReadError` for I/O failures
  - `PermissionError` for authorization failures
  - `TimeoutError` for slow/unresponsive resources

### 3.6 `list(address, options?)` *(Optional)*

List contents of a directory resource.

**Requirements**:
- Only required when driver supports directory traversal
- Respect `recursive` and `maxDepth` options
- Apply `filter` function if provided
- Return entries sorted alphabetically by name (directories first)

## 4. Error Types

All drivers MUST use standardized error types:

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

## 5. Driver Registration

Drivers self-register using the following pattern:

```typescript
import { registerDriver } from '@avfs/core';

class MyCustomDriver implements AVFSDriver {
  readonly protocol = 'my-custom';
  readonly version = '1.0.0';
  readonly displayName = 'My Custom Storage';
  readonly description = 'Accesses my custom storage service';

  async initialize(config: DriverConfig): Promise<void> { /* ... */ }
  async destroy(): Promise<void> { /* ... */ }
  async connect(addr: ParsedAddress): Promise<Connection> { /* ... */ }
  async stat(addr: ParsedAddress): Promise<ResourceMetadata> { /* ... */ }
  async read(addr: ParsedAddress, opts?: ReadOptions): Promise<ReadableStream<Uint8Array>> { /* ... */ }
}

// Register with the runtime
registerDriver(new MyCustomDriver());
```

## 6. Built-in Driver Reference

See the main spec [Section 2.1.1](./avfs-v1-standard.md#211-built-in-official-protocol--driver-mapping) for the list of official built-in drivers and their protocol identifiers.
