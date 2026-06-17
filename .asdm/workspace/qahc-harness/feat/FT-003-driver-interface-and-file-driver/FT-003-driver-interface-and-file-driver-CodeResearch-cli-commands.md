# FT-003 Code Research — cli-commands 模块

> **扫描范围**：`cli/src/commands/*` + `cli/src/parser/*` + `cli/test/commands/*`
> **扫描日期**：2026-06-17
> **扫描类型**：只读探索

---

## 1. 代码库概述

### 模块定位

CLI 命令层（`cli/src/commands/`）负责命令行交互，使用 Commander.js 注册子命令。解析层（`cli/src/parser/`）负责 `avfs://` URI 解析、校验和双向转换。两层共同构成 CLI 的用户入口。

### 文件组织

```
cli/src/
├── index.ts                          # CLI 入口（Node 版本检查 + Commander 注册）
├── commands/
│   ├── index.ts                      # registerAllCommands() — 注册 6 个命令
│   ├── stat.command.ts               # stat 命令 ← FT-003 核心变更
│   ├── fetch.command.ts              # fetch 命令 ← FT-003 核心变更
│   ├── convert.command.ts            # convert 命令（参考模式）
│   ├── validate.command.ts           # validate 命令（参考模式）
│   ├── plugin.command.ts             # plugin 命令（桩）
│   └── credential.command.ts         # credential 命令（桩）
├── parser/
│   ├── index.ts                      # 公共 API 导出
│   ├── types.ts                      # ParsedAddress 等核心类型 ← 关键
│   ├── uri-parser.ts                 # parseAvfsUri() 主解析器
│   ├── validator.ts                  # validateAvfsUri() 包装
│   ├── git/                          # Git 平台策略（GitHub）
│   └── protocol-converters/          # 协议转换器（5 个 + 注册表）
└── drivers/                          # （见 cli-drivers 调研报告）
```

### 技术栈

- **CLI 框架**：Commander v14（`commander ^14.0.0`）
- **测试框架**：vitest 3.2.4
- **模块系统**：ESM（`.js` 后缀 import）

---

## 2. 现有实现分析

### A. ParsedAddress 类型定义（`parser/types.ts` L13-30）— 关键

```typescript
export interface ParsedAddress {
  protocol: ProtocolType | string;    // 协议标识符（允许任意字符串）
  resourceBase: string;                // 资源基址（如 "github.com/avfs-io/core"）
  version: string | null;              // 版本/分支/tag（仅 git，其余为 null）
  filePath: string | null;             // 文件相对路径（可能为 null）
  anchor: string | null;               // 锚点片段（# 之后）
  rawInput: string;                    // 原始输入地址
  isValid: boolean;                    // 校验是否通过
  errors: string[];                    // 校验错误列表（isValid=false 时非空）
}
```

**与 spec（`driver-interface.md` §2.1）的差异**：

| 字段 | 代码版 | spec 版 | 差异说明 |
|------|--------|---------|----------|
| 原始输入 | `rawInput: string` | `raw: string` | 字段名不同 |
| 协议 | `protocol: ProtocolType \| string` | `protocol: string` | 代码有联合类型 |
| 版本 | `version: string \| null` | `version?: string` | null vs optional |
| 文件路径 | `filePath: string \| null` | `filePath: string` | null vs 非空 |
| 锚点 | `anchor: string \| null` | `anchor?: string` | null vs optional |
| 校验信息 | `isValid: boolean` + `errors: string[]` | 无 | 代码独有 |
| 查询参数 | 无 | `query?: Record<string, string>` | spec 独有 |

**结论**：代码版 `ParsedAddress` 比 spec 版更丰富（含校验信息），但字段命名和可空性不同。FT-002 已将 spec 文档对齐到代码版（`?ref=` 语法），driver-interface.md 中的 ParsedAddress 定义是旧的。

#### 其他 parser 类型

```typescript
export const SUPPORTED_PROTOCOLS = ['file', 'http', 'https', 'smb', 'git'] as const;
export type ProtocolType = (typeof SUPPORTED_PROTOCOLS)[number];

export interface NativeUrl { url: string; protocol: ProtocolType; metadata?: Record<string, string | null>; }
export interface ConvertOptions { direction: 'to-avfs' | 'to-native'; protocol?: ProtocolType; }
export interface ConvertResult { input: string; output: string; direction: ...; protocol: ProtocolType; isJson: boolean; }
export interface ValidationResult { valid: boolean; address?: ParsedAddress; errors?: string[]; }
```

---

### B. stat.command.ts（L1-23）— FT-003 核心变更目标

```typescript
import type { Command } from 'commander';
import { parseAvfsUri } from '../parser/uri-parser.js';

export function registerStatCommand(program: Command): void {
  program
    .command('stat')
    .description('Get file metadata from an AVFS address')
    .argument('<address>', 'AVFS address to inspect')
    .action((address: string) => {
      try {
        const parsed = parseAvfsUri(address);
        console.log(JSON.stringify(parsed));      // ← 仅输出 ParsedAddress JSON
        if (!parsed.isValid) {
          process.exitCode = 1;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
```

**当前行为**：
- 解析地址 → 输出 `ParsedAddress` JSON（协议/资源基址/版本/路径等字段）
- **不调用任何驱动**
- **不获取文件元数据**
- 无命令选项

**FT-003 需变更**：
1. 解析地址后按 `parsed.protocol` 匹配驱动
2. 调用 `driver.stat(parsed)` 获取 `ResourceMetadata`
3. 输出 `ResourceMetadata` JSON（而非 ParsedAddress）
4. 驱动未实现 stat 时捕获 `NotImplementedError` 并输出明确错误

---

### C. fetch.command.ts（L1-75）— FT-003 核心变更目标

```typescript
import type { Command } from 'commander';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseAvfsUri } from '../parser/uri-parser.js';
import { GitDriver } from '../drivers/git.driver.js';

export function registerFetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('Fetch a file from an AVFS address (git protocol only)')
    .argument('<address>', 'AVFS address to fetch')
    .option('-o, --output <file>', 'Write output to a file instead of stdout')
    .action(async (address: string, options: { output?: string }) => {
      try {
        // 1. 解析 AVFS URI
        const parsed = parseAvfsUri(address);
        if (!parsed.isValid) { /* error */ return; }

        // 2. 协议检查 — 仅 git 支持
        if (parsed.protocol !== 'git') {
          console.error(`Error: fetch for protocol "${parsed.protocol}" is not yet implemented. Only "git" protocol is supported.`);
          process.exitCode = 1;
          return;
        }

        // 3. 校验必填字段
        if (!parsed.filePath) { /* error */ return; }

        // 4. 连接并读取
        const driver = new GitDriver();                                    // ← 硬编码 GitDriver
        const connectOptions = parsed.version
          ? { credentials: { version: parsed.version } }
          : undefined;
        await driver.connect(parsed.resourceBase, connectOptions);         // ← 旧签名
        const stream = await driver.read(parsed.filePath);                 // ← 旧签名

        // 5. 流输出 — Web ReadableStream → Node.js Readable
        const nodeReadable = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
        const destination = options.output ? createWriteStream(options.output) : process.stdout;
        await pipeline(nodeReadable, destination);

        if (!options.output && process.stdout.isTTY) { console.log(); }
        await driver.close();
      } catch (error: unknown) { /* error handling */ }
    });
}
```

**当前行为**：
- **硬编码 `new GitDriver()`**，无协议分发
- 非 git 协议直接报错退出
- version 通过 `credentials: { version }` hack 传递
- 流处理：Web `ReadableStream` → `Readable.fromWeb()` → `pipeline()` → stdout/file

**FT-003 需变更**：
1. 移除硬编码 GitDriver，建立协议→驱动分发框架
2. file 协议路由到 FileDriver，git 路由到 GitDriver，其余仍报错（或抛 NotImplementedError）
3. 适配新接口签名：`driver.connect(parsed)` → `driver.read(parsed)` 
4. 复用流处理逻辑（`Readable.fromWeb` + `pipeline`）

---

### D. 命令注册模式（`commands/index.ts`）

```typescript
export function registerAllCommands(program: Command): void {
  registerFetchCommand(program);
  registerConvertCommand(program);
  registerStatCommand(program);
  registerValidateCommand(program);
  registerPluginCommand(program);
  registerCredentialCommand(program);
}
```

每个命令文件导出 `registerXxxCommand(program: Command)` 函数，在 `index.ts` 中统一调用。

### E. CLI 入口（`index.ts`）

```typescript
// Node.js 版本检查 (>= 20)
const program = new Command();
program.name('avfs').version(pkg.version, '-V, --version').description(pkg.description);
registerAllCommands(program);
program.parse(process.argv);
```

---

### F. 驱动访问模式 — 关键发现

**无驱动注册表**。`fetch.command.ts` 直接 `import { GitDriver }` 然后 `new GitDriver()`。`stat.command.ts` 完全不访问驱动。

**FT-003 需建立的分发框架**：

方案选择（基于 DP6 决策）：
1. **轻量分发函数**：在 commands 层或新建 `driver-registry.ts`，维护 `Map<protocol, Driver>` 映射
2. stat/fetch 命令调用 `getDriver(parsed.protocol)` 获取驱动实例
3. 驱动实例可缓存或每次新建（GitDriver 无状态，每次新建更简单）

---

### G. 测试模式

#### `test/commands/fetch.test.ts`
- 使用 vitest
- mock `parseAvfsUri` 和 `GitDriver`（`vi.mock`）
- 测试场景：合法 git 地址 fetch、非法协议、无 filePath、-o 输出
- 使用 `execSync` 子进程测试集成场景

#### `test/commands.test.ts`
- 集成测试，使用 `execSync` 调用 CLI 二进制
- 测试 `--version`、`--help`、`stat`、`fetch`、`convert`、`validate` 命令

#### `test/fixtures/addressing/`
- `valid-uris.json`：15 条合法 URI 测试用例
- `invalid-uris.json`：10 条非法 URI 测试用例

---

## 3. 关键发现

### 3.1 ParsedAddress 已在 parser 层完整定义

`parser/types.ts` 的 `ParsedAddress` 已包含驱动接口所需的全部字段（protocol/resourceBase/version/filePath/anchor）。驱动接口可直接使用此类型，无需新建。

### 3.2 流处理模式可复用

`fetch.command.ts` 的 Web→Node 流转换 + pipeline 模式已验证可行，FileDriver 的 fetch 可直接复用。

### 3.3 stat 命令改动最小

当前 stat 命令仅 23 行，改为调用 `driver.stat(parsed)` 后逻辑清晰。需新增协议分发逻辑。

### 3.4 fetch 命令需重构分发逻辑

当前硬编码 GitDriver 的 4 行代码（L49-53）需替换为协议分发。version 传递方式从 `credentials` hack 改为 ParsedAddress 直接传递。

### 3.5 无需修改 parser 层

地址解析逻辑不变，`parseAvfsUri()` 已返回完整的 `ParsedAddress`。FT-003 不涉及 parser 变更。

---

## 4. 缺失项（FT-003 需新增）

| # | 缺失项 | 说明 |
|:-:|--------|------|
| 1 | 驱动分发框架 | 协议→驱动映射 + `getDriver(protocol)` 函数 |
| 2 | stat 命令改造 | 调用 `driver.stat(parsed)` 输出 ResourceMetadata |
| 3 | fetch 命令改造 | 协议分发 + 新接口签名适配 |
| 4 | stat 命令测试 | 新增 stat 命令测试（mock 驱动） |
| 5 | fetch 命令测试更新 | 适配新分发逻辑 + file 协议场景 |

---

## 5. 待确认问题

### Q1: 驱动分发框架的形态？

选项：
- **A**：新建 `cli/src/drivers/registry.ts`，维护 `Map<protocol, Driver>`，导出 `getDriver(protocol)`
- **B**：在 commands 层内联 if/switch 分发（轻量但不可复用）

**建议**：选 A，为未来 http/https/smb 驱动实现预留扩展点，符合 DP6"统一协议分发框架"决策。

### Q2: stat 命令对目录的处理？

FileDriver 的 `list()` 可列出目录内容。`avfs stat <目录路径>` 时应：
- **A**：调用 `stat()` 返回目录元数据（type=directory），不列出内容
- **B**：检测到目录时调用 `list()` 返回 `Entry[]`

PRD 2.1 场景一选择了 B（列出目录内容），但命令名是 `stat`（元数据查询）。**建议**：stat 对目录返回目录元数据，目录列表通过 `list()` 方法暴露但当前 CLI 无 `avfs list` 命令调用它。PRD 2.1 场景需调整或新增 `avfs list` 命令。

### Q3: stat/fetch 命令是否需要调用 initialize/destroy？

新接口有 `initialize(config)`/`destroy()` 生命周期方法。CLI 命令是否需要调用？

**建议**：命令层在创建驱动实例后调用 `initialize({})`（空配置），操作完成后调用 `destroy()`。FileDriver/GitDriver 的 initialize/destroy 为 no-op，但保持接口一致性。

---

**调研完成日期**：2026-06-17
**调研人**：AI Agent (qahc-harness)
