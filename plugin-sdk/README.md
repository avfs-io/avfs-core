# Plugin SDK

Development SDK for building custom protocol & driver extensions.

## Overview

AVFS supports a **Protocol-Driver matched plugin mechanism**. This SDK provides everything needed to implement a custom driver plugin that integrates seamlessly with the AVFS core engine.

## What You Can Extend

| Capability | Description |
|-----------|-------------|
| Custom Protocol | Define a new protocol identifier (e.g., `oss`, `ftp`, `s3`) |
| Custom Driver | Implement `connect()`, `read()`, `stat()`, `anchor()` methods |
| Hot Registration | Register/unregister plugins at runtime without restarting core |
| Lifecycle Hooks | Optional pre/post hooks for auth, caching, logging, etc. |

## Quick Start Template

```typescript
import { AvfsDriverBase, AvfsRegistry } from '@avfs/plugin-sdk';

class MyCustomDriver extends AvfsDriverBase {
  readonly protocol = 'my-proto';

  async connect(resourceBase: string): Promise<void> { /* ... */ }
  async read(filePath: string, version?: string): Promise<AvfsResource> { /* ... */ }
  async stat(filePath: string, version?: string): Promise<AvfsMetadata> { /* ... */ }
  async anchor(filePath: string, anchor: string, version?: string): Promise<string> { /* ... */ }
  async close(): Promise<void> { /* ... */ }
}

// Register to AVFS core
AvfsRegistry.register(new MyCustomDriver());
```

## SDK Contents (Planned)

| File / Package | Description | Status |
|----------------|-------------|--------|
| `AvfsDriverBase` | Abstract base class with default lifecycle implementation | Planned |
| `AvfsRegistry` | Static methods for register / unregister / list / dispatch | Planned |
| `AvfsResource` | Standardized resource output type (stream + metadata) | Planned |
| `AvfsMetadata` | File metadata interface (size, mime-type, last-modified, etc.) | Planned |
| `types.ts` | Shared TypeScript type definitions | Planned |
| `cli-plugin-loader.ts` | CLI-side dynamic `.so` / module loader | Planned |

## Plugin Lifecycle

```
1. Developer creates driver class extending AvfsDriverBase
2. Calls AvfsRegistry.register(instance)
3. Core parser detects matching protocol in address
4. Router dispatches request to registered driver instance
5. Driver handles connect → read/stat → return result
6. Caller can call AvfsRegistry.unregister('protocol') to remove
```

## Guidelines

1. **Protocol naming**: Use lowercase alphanumeric + hyphens; avoid conflict with built-ins (`file`, `http`, `https`, `smb`, `git`)
2. **Error handling**: Wrap all I/O in try-catch; return standardized error codes
3. **Binary transparency**: Never modify original bytes or headers; pass through as-is
4. **Thread safety**: Drivers may be called concurrently; ensure internal state is safe

## Dependencies

- [Core](../core/README.md) — Registry integration target
- [Spec](../spec/README.md) — Driver interface contract this SDK implements
- [Examples](../examples/README.md) — Sample custom plugin implementations
