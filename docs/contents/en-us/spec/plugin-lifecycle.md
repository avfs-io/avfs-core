# AVFS Plugin Lifecycle Specification

> Part of [AVFS v1 Standard](./avfs-v1-standard.md) — Plugin registration, routing, hot-swap, and lifecycle management.

## 1. Lifecycle Overview

An AVFS driver plugin progresses through well-defined states from registration to removal. The core runtime manages all state transitions.

```
                    ┌─────────────┐
     register()    │   UNLOADED  │
   ───────────────►│             │
                    └──────┬──────┘
                           │ initialize()
                           ▼
                    ┌─────────────┐
                    │  INITIALIZING│
                    │             │
                    └──────┬──────┘
                           │ success
                           ▼
                    ┌─────────────┐
              ┌────►│   ACTIVE    │◄────┐
              │     │  (ready to  │     │
              │     │   serve)    │     │
              │     └──────┬──────┘     │
              │            │            │
              │  disable() │  enable()
              │            │            │
              │            ▼            │
              │     ┌─────────────┐     │
              │     │   DISABLED  │─────┘
              │     │ (paused,    │
              │     │  not routed)│
              │     └──────┬──────┘
              │            │
              │     unregister()
              │            │
              │            ▼
              │     ┌─────────────┐
              └─────│ DESTROYING  │
                    │             │
                    └──────┬──────┘
                           │ destroy() complete
                           ▼
                    ┌─────────────┐
                    │  UNLOADED   │
                    └─────────────┘
```

## 2. State Definitions

| State | Description | Routable | Operations Allowed |
|-------|-------------|----------|-------------------|
| `UNLOADED` | Plugin not registered | No | register() |
| `INITIALIZING` | Running `initialize()` | No | (internal transition) |
| `ACTIVE` | Fully initialized, ready | Yes | disable(), unregister(), connect/stat/read/list |
| `DISABLED` | Paused, connections preserved | No | enable(), unregister(), destroy() |
| `DESTROYING` | Running `destroy()` | No | (internal transition) |

## 3. Phase Details

### 3.1 Register

**Trigger**: Explicit call to `registerDriver()` or auto-discovery at startup.

**Actions**:
1. Validate driver implements `AVFSDriver` interface
2. Check `protocol` identifier uniqueness (conflict throws `ProtocolConflictError`)
3. Set initial state to `UNLOADED`
4. Call `driver.initialize(config)` asynchronously
5. On success: transition to `ACTIVE`
6. On failure: revert to `UNLOADED`, emit error event

**Code Example**:
```typescript
import { registry, registerDriver } from '@avfs/core';

const myDriver = new S3Driver({ region: 'us-west-2' });
registerDriver(myDriver);

// Or with explicit config override:
registry.register('s3', myDriver, {
  timeout: 30000,
  credentials: { accessKey: '...', secretKey: '...' }
});
```

### 3.2 Route

**Trigger**: Incoming request with parsed address containing a known `protocol`.

**Routing Algorithm**:
1. Extract `protocol` from `ParsedAddress`
2. Look up driver in global `ProtocolRegistry`
3. If not found → throw `UnknownProtocolError`
4. If found but state != `ACTIVE` → throw `DriverNotReadyError`
5. Dispatch request to matched driver's appropriate method

**Request Dispatch Map**:

| Request Type | Method Called |
|-------------|--------------|
| Read content | `driver.read(address)` |
| Get metadata | `driver.stat(address)` |
| List directory | `driver.list?(address)` |
| Check existence | `driver.exists?(address)` |

### 3.3 Process

The driver executes the actual resource operation. This phase is driver-specific but follows common patterns:

1. Parse `resourceBase` and `filePath` into native format
2. Establish connection (reuse if connection pooling available)
3. Authenticate if needed (token refresh, credential check)
4. Execute the operation (HTTP request, filesystem read, Git checkout, etc.)
5. Collect metadata (size, mime type, modification time)
6. Return results through standardized types

### 3.4 Manage

Runtime management operations for operational flexibility:

#### Hot Reload

```typescript
await registry.reload('s3'); // Re-initialize without full restart
```

- Calls `destroy()` then `initialize()` on the same driver instance
- Preserves protocol binding
- Transiently moves through `DESTROYING` → `UNLOADED` → `INITIALIZING` → `ACTIVE`
- Existing in-flight requests complete under old instance; new requests use new instance

#### Disable / Enable

```typescript
await registry.disable('smb');  // Pause accepting new requests
await registry.enable('smb');   // Resume accepting requests
```

- `disable()`: Move to `DISABLED` state; new requests rejected with `DriverDisabledError`; existing connections stay open
- `enable()`: Return to `ACTIVE` state; immediately resume routing

#### Unregister

```typescript
await registry.unregister('ftp'); // Full removal
```

1. Reject all new incoming requests
2. Wait for in-flight requests to complete (or timeout after configurable grace period)
3. Call `driver.destroy()`
4. Remove from registry
5. Transition to `UNLOADED`

## 4. Event System

Plugins emit lifecycle events that can be subscribed to:

```typescript
registry.on('registered', (event) => {
  console.log(`Driver ${event.protocol} v${event.version} registered`);
});

registry.on('state-changed', (event) => {
  console.log(`${event.protocol}: ${event.fromState} -> ${event.toState}`);
});

registry.on('error', (event) => {
  console.error(`${event.protocol} error: ${event.error.message}`);
});
```

**Event Types**:

| Event Name | Payload | When Emitted |
|------------|---------|-------------|
| `registered` | `{ protocol, version, driver }` | After successful register |
| `unregistered` | `{ protocol }` | After successful unregister |
| `state-changed` | `{ protocol, fromState, toState }` | On any state transition |
| `error` | `{ protocol, error }` | On any driver error |
| `request-start` | `{ protocol, address, method }` | Before dispatching |
| `request-end` | `{ protocol, address, method, duration, status }` | After completion |

## 5. Concurrency & Isolation

### 5.1 Request Isolation

Each request operates independently:
- Separate connection per request (or pooled with isolation guarantees)
- No shared mutable state between concurrent requests
- Driver methods must be thread-safe / async-safe

### 5.2 State Transition Safety

State transitions are serialized:
- Only one transition at a time per driver
- Transitions are atomic (all-or-nothing)
- Race conditions handled by internal mutex/queue

## 6. Configuration

### 6.1 Global Runtime Config

```typescript
interface RuntimeConfig {
  defaultTimeout: number;        // ms, default 30000
  maxConcurrentRequests: number; // per-driver limit, default 10
  connectionPoolSize: number;    // default 5
  enableHotReload: boolean;      // default true
  gracefulShutdownTimeout: number; // ms, default 5000
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
```

### 6.2 Per-Driver Config

Each driver receives its own config during `initialize()`:

```typescript
interface DriverConfig {
  credentials?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  cachePolicy?: 'none' | 'metadata' | 'full';
  customOptions?: Record<string, unknown>;
}
```

## 7. Security Considerations

- **Credential isolation**: Each driver's credentials never leak to other drivers
- **Sandboxing**: Drivers run in isolated contexts where possible (worker threads, processes)
- **Protocol validation**: User-supplied `protocol` strings sanitized before lookup
- **Resource limits**: Memory/CPU quotas enforceable per-driver
- **Audit trail**: All registrations, unregistrations, and state changes logged
