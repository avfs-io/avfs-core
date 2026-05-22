# AVFS 插件生命周期规范

> 属于 [AVFS v1 规范](./avfs-v1-standard.md) — 插件注册、路由、热插拔及生命周期管理。

## 1. 生命周期概述

AVFS 驱动插件从注册到移除经历明确定义的状态。核心运行时管理所有状态转换。

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
                           │ 成功
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
                           │ destroy() 完成
                           ▼
                    ┌─────────────┐
                    │  UNLOADED   │
                    └─────────────┘
```

## 2. 状态定义

| 状态 | 说明 | 可路由 | 允许的操作 |
|------|------|--------|-----------|
| `UNLOADED` | 插件未注册 | 否 | register() |
| `INITIALIZING` | 正在执行 `initialize()` | 否 | （内部状态转换） |
| `ACTIVE` | 已完全初始化，就绪 | 是 | disable()、unregister()、connect/stat/read/list |
| `DISABLED` | 已暂停，连接保留 | 否 | enable()、unregister()、destroy() |
| `DESTROYING` | 正在执行 `destroy()` | 否 | （内部状态转换） |

## 3. 各阶段详情

### 3.1 注册

**触发条件**：显式调用 `registerDriver()` 或启动时的自动发现。

**执行步骤**：
1. 验证驱动实现了 `AVFSDriver` 接口
2. 检查 `protocol` 标识唯一性（冲突则抛出 `ProtocolConflictError`）
3. 设置初始状态为 `UNLOADED`
4. 异步调用 `driver.initialize(config)`
5. 成功：转换到 `ACTIVE`
6. 失败：回退至 `UNLOADED`，发出错误事件

**代码示例**：
```typescript
import { registry, registerDriver } from '@avfs/core';

const myDriver = new S3Driver({ region: 'us-west-2' });
registerDriver(myDriver);

// 或显式配置覆盖：
registry.register('s3', myDriver, {
  timeout: 30000,
  credentials: { accessKey: '...', secretKey: '...' }
});
```

### 3.2 路由

**触发条件**：包含已知 `protocol` 的已解析地址的传入请求。

**路由算法**：
1. 从 `ParsedAddress` 中提取 `protocol`
2. 在全局 `ProtocolRegistry` 中查找驱动
3. 未找到 → 抛出 `UnknownProtocolError`
4. 找到但状态不是 `ACTIVE` → 抛出 `DriverNotReadyError`
5. 将请求分派给匹配驱动的对应方法

**请求分发表**：

| 请求类型 | 调用的方法 |
|----------|-----------|
| 读取内容 | `driver.read(address)` |
| 获取元数据 | `driver.stat(address)` |
| 列出目录 | `driver.list?(address)` |
| 检查存在 | `driver.exists?(address)` |

### 3.3 处理

驱动执行实际的资源操作。此阶段因驱动而异但遵循通用模式：

1. 将 `resourceBase` 和 `filePath` 解析为原生格式
2. 建立连接（如有连接池则复用）
3. 必要时认证（令牌刷新、凭证检查）
4. 执行操作（HTTP 请求、文件系统读取、Git checkout 等）
5. 收集元数据（大小、MIME 类型、修改时间）
6. 通过标准化类型返回结果

### 3.4 管理

运行时管理操作，提供运维灵活性：

#### 热重载

```typescript
await registry.reload('s3'); // 无需完全重启即可重新初始化
```

- 对同一驱动实例依次调用 `destroy()` 再 `initialize()`
- 保留协议绑定
- 瞬间经过 `DESTROYING` → `UNLOADED` → `INITIALIZING` → `ACTIVE`
- 已有的在途请求由旧实例完成；新请求使用新实例

#### 禁用 / 启用

```typescript
await registry.disable('smb');  // 暂停接收新请求
await registry.enable('smb');   // 恢复接收请求
```

- `disable()`：转移到 `DISABLED` 状态；新请求以 `DriverDisabledError` 拒绝；现有连接保持打开
- `enable()`：回到 `ACTIVE` 状态；立即恢复路由

#### 注销

```typescript
await registry.unregister('ftp'); // 完全移除
```

1. 拒绝所有新的传入请求
2. 等待在途请求完成（或在可配置宽限期后超时）
3. 调用 `driver.destroy()`
4. 从注册表中移除
5. 转换到 `UNLOADED`

## 4. 事件系统

插件发出可订阅的生命周期事件：

```typescript
registry.on('registered', (event) => {
  console.log(`驱动 ${event.protocol} v${event.version} 已注册`);
});

registry.on('state-changed', (event) => {
  console.log(`${event.protocol}: ${event.fromState} -> ${event.toState}`);
});

registry.on('error', (event) => {
  console.error(`${event.protocol} 错误: ${event.error.message}`);
});
```

**事件类型**：

| 事件名称 | 数据载荷 | 触发时机 |
|---------|---------|---------|
| `registered` | `{ protocol, version, driver }` | 注册成功后 |
| `unregistered` | `{ protocol }` | 注销成功后 |
| `state-changed` | `{ protocol, fromState, toState }` | 任何状态转换时 |
| `error` | `{ protocol, error }` | 任何驱动错误时 |
| `request-start` | `{ protocol, address, method }` | 分发之前 |
| `request-end` | `{ protocol, address, method, duration, status }` | 完成之后 |

## 5. 并发与隔离

### 5.1 请求隔离

每个请求独立执行：
- 每个请求独立连接（或使用带隔离保证的连接池）
- 并发请求间无可变共享状态
- 驱动方法必须是线程安全 / 异步安全的

### 5.2 状态转换安全性

状态转换是串行化的：
- 同一时刻每个驱动只允许一个转换
- 转换是原子的（全有或全无）
- 竞态条件由内部互斥锁/队列处理

## 6. 配置

### 6.1 全局运行时配置

```typescript
interface RuntimeConfig {
  defaultTimeout: number;        // 毫秒，默认 30000
  maxConcurrentRequests: number; // 每驱动限制，默认 10
  connectionPoolSize: number;    // 默认 5
  enableHotReload: boolean;      // 默认 true
  gracefulShutdownTimeout: number; // 毫秒，默认 5000
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
```

### 6.2 每个驱动的配置

每个驱动在 `initialize()` 期间收到各自的配置：

```typescript
interface DriverConfig {
  credentials?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  cachePolicy?: 'none' | 'metadata' | 'full';
  customOptions?: Record<string, unknown>;
}
```

## 7. 安全考虑

- **凭证隔离**：每个驱动的凭证绝不会泄露给其他驱动
- **沙箱隔离**：驱动尽可能在隔离上下文中运行（工作线程、进程）
- **协议验证**：用户提供的 `protocol` 字符串在查找前经过净化处理
- **资源限制**：可按驱动强制执行内存/CPU 配额
- **审计日志**：记录所有注册、注销和状态变更
