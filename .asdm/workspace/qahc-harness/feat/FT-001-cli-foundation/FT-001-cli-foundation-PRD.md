# FT-001 CLI 基础框架 — PRD 产品需求文档

> **🔗 前置依赖**：本文档基于 [FT-001-cli-foundation-AskMe.md](./FT-001-cli-foundation-AskMe.md)（需求访谈文档）编写。

> 最后更新：2026-05-24

---

## 修订记录

| 版本 | 日期 | 修订人 | 修订内容 |
| ------ | ------ | -------- | ---------- |
| 1.0.0 | 2026-05-24 | AI Agent | 初始版本（总体概述 + 使用场景） |
| 1.1.0 | 2026-05-24 | AI Agent | 阶段二详细设计补充 |

---

## 目录

- [1. 总体概述](#1-总体概述)
  - [1.1 背景与目标](#11-背景与目标)
  - [1.2 核心概念](#12-核心概念)
  - [1.3 变更范围](#13-变更范围)
  - [1.4 关键决策](#14-关键决策)
- [2. 使用场景](#2-使用场景)
  - [2.1 场景一：查看 CLI 帮助信息](#21-场景一查看-cli-帮助信息)
  - [2.2 场景二：查看 CLI 版本](#22-场景二查看-cli-版本)
  - [2.3 场景三：尝试未实现命令](#23-场景三尝试未实现命令)
  - [2.4 场景四：输错命令](#24-场景四输错命令)
  - [2.5 场景五：开发者本地构建与测试](#25-场景五开发者本地构建与测试)
  - [2.6 场景六：CI/CD 自动构建与发布](#26-场景六cicd-自动构建与发布)
- [3. 技术方案](#3-技术方案)
  - [3.1 目录结构](#31-目录结构)
  - [3.2 构建管线](#32-构建管线)
  - [3.3 命令注册模式](#33-命令注册模式)
  - [3.4 Mock 命令实现](#34-mock-命令实现)
  - [3.5 Node 版本运行时检查](#35-node-版本运行时检查)
- [4. 接口设计](#4-接口设计)
  - [4.1 Driver 接口](#41-driver-接口)
  - [4.2 命令注册约定](#42-命令注册约定)
- [5. 数据模型](#5-数据模型)
  - [5.1 核心类型定义](#51-核心类型定义)
- [6. 依赖关系](#6-依赖关系)
  - [6.1 运行时依赖](#61-运行时依赖)
  - [6.2 开发依赖](#62-开发依赖)
  - [6.3 NPM Scripts](#63-npm-scripts)
- [7. 风险与缓解](#7-风险与缓解)
- [8. 验收条件 (DoD)](#8-验收条件-dod)
  - [8.1 核心功能](#81-核心功能)
  - [8.2 CI/CD](#82-cicd)
  - [8.3 非功能需求](#83-非功能需求)

---

## 1. 总体概述

### 1.1 背景与目标

AVFS（Agent Virtual File System）是一个通用跨存储寻址协议，目前处于**规范先行、代码空白**阶段。`cli/`、`core/`、`driver/` 等关键目录均仅有 README 规划，没有任何实现代码。

本特性是 AVFS 项目的首个开发特性，目标是从零搭建 CLI 工具的基础骨架：

- **建立可执行的 CLI 入口**：让 `avfs` 命令可以被实际执行，输出 help 和 version 信息
- **为全部子命令预置 Mock 入口**：为 fetch、convert、stat、validate、plugin、credential 6 组子命令建立骨架注册，当前返回占位提示，降低后续开发接入成本
- **Driver 接口集中管理**：在项目启动阶段，将 5 类内置驱动（file/http/https/smb/git）的接口定义和空实现集中在 CLI 包内，避免多包依赖管理的复杂性，后续再拆分到独立 `driver/` 目录
- **CI/CD 流水线就绪**：建立 GitHub Actions 自动构建（lint → test → build）和发布（v* tag → npm publish）流程

### 1.2 核心概念

| 概念 | 说明 |
|------|------|
| **CLI 入口** | `avfs` 命令，基于 commander.js 构建，支持子命令分发和全局选项 |
| **命令模块** | 每个子命令（fetch/convert/stat/validate/plugin/credential）为独立文件，通过 `commands/index.ts` 统一注册到 commander 程序实例 |
| **Mock 命令** | 当前阶段未实现的子命令，输出友好提示信息引导用户查看 `avfs help`，退出码 0 |
| **Driver 接口** | 定义 `connect()`、`read()`、`stat()`、`close()` 统一接口契约，5 类协议驱动暂存于 `cli/src/drivers/` |
| **构建产物** | tsup 打包产出 ESM（`dist/index.mjs`）+ CJS（`dist/index.cjs`）双格式，`bin` 指向 ESM 入口 |

### 1.3 变更范围

| 变更模块 | 变更类型 | 变更描述 |
| ---------- | :--------: | ---------- |
| `cli/package.json` | 新增 | 包名 `@avfs/avfs-cli`，`bin: { "avfs": "./dist/index.mjs" }`，`engines: { "node": ">=20" }`，`"type": "module"` |
| `cli/tsconfig.json` | 新增 | TypeScript 配置，target ES2022，module NodeNext，strict 模式 |
| `cli/tsup.config.ts` | 新增 | 构建配置，ESM + CJS 双输出，输出目录 `dist/` |
| `cli/src/index.ts` | 新增 | CLI 入口，创建 commander 程序实例，注册全部命令，启动 argv 解析 |
| `cli/src/commands/` | 新增 | 7 个命令文件：`fetch.command.ts`、`convert.command.ts`、`stat.command.ts`、`validate.command.ts`、`plugin.command.ts`、`credential.command.ts`（6 个 Mock）+ `index.ts`（注册器） |
| `cli/src/drivers/` | 新增 | 6 个文件：`driver.interface.ts`（接口定义）+ `file.driver.ts`、`http.driver.ts`、`https.driver.ts`、`smb.driver.ts`、`git.driver.ts`（5 个空实现） |
| `cli/test/` | 新增 | vitest 测试目录，含 help/version 命令的基础测试 |
| `.github/workflows/avfs-cli-ci.yml` | 新增 | CI 流水线：push/PR 触发，矩阵 20.x/22.x/24.x，lint → test → build |
| `.github/workflows/avfs-cli-publish.yml` | 新增 | CD 流水线：v* tag 触发，build → npm publish（`--access public`） |
| `cli/.gitignore` | 新增 | 忽略 `node_modules/`、`dist/` |

### 1.4 关键决策

| # | 决策点 | 决策结论 | 理由摘要 |
| --- | ------ | ---------- | ---------- |
| 1 | 技术栈 | TypeScript + commander.js + tsup | 与 README 规划一致，社区成熟 |
| 2 | Node.js 版本 | >= 20，纯 ESM | 18 已 EOL，20 为合理底线 |
| 3 | 包管理器 | pnpm | 用户指定，严格依赖，磁盘效率高 |
| 4 | 测试框架 | vitest | 原生 ESM/TS 支持，零配置 |
| 5 | Mock 命令行为 | 友好提示 + 退出码 0 | FT-001 阶段面向开发者手动验证 |
| 6 | Driver 组织方式 | `cli/src/drivers/` 扁平目录 | 拆分时直接整体迁移 |
| 7 | 命令注册模式 | 独立文件 + `commands/index.ts` 批量注册 | 与 README 结构一致，清晰扩展点 |
| 8 | CI/CD 触发策略 | CI: push/PR; CD: v* tag | 版本号由 tag 控制，语义清晰 |
| 9 | CI Node 版本矩阵 | 20.x、22.x、24.x | 覆盖当前全部活跃版本 |
| 10 | npm 发布 | 公共 registry，`@avfs/avfs-cli`，public | 开源公开，一条命令安装 |
| 11 | 构建产物格式 | ESM + CJS 双输出，bin 指向 ESM | tsup 零配置，兼容性覆盖 |
| 12 | Node 版本检查 | `engines` + 运行时提示 | 低版本用户明确知道原因 |
| 13 | 无效命令 | commander 默认处理 | 零成本，行为标准 |
| 14 | 无参数运行 | commander 默认 help | 用户能立即看到所有命令 |
| 15 | --version 输出 | 仅版本号 | 脚本友好 |
| 16 | publish 失败 | 直接失败 | 硬错误需人工介入 |
| 17 | dist/ 管理 | .gitignore + CI 生成 | npm 生态标准实践 |

---

## 2. 使用场景

### 2.1 场景一：查看 CLI 帮助信息

**角色**：开发者（首次接触 avfs CLI）
**前置条件**：已通过 `npm install -g @avfs/avfs-cli` 安装（推荐，也支持 pnpm/yarn）

**操作步骤**：
1. 打开终端
2. 执行 `avfs`
3. 系统输出 commander 默认帮助信息（列出全部可用子命令和全局选项）

**预期结果**：
- 终端输出包含 `Usage: avfs [options] [command]`
- 列出所有已注册命令：`fetch`、`convert`、`stat`、`validate`、`plugin`、`credential`、`help`
- 列出全局选项：`-V, --version`、`-h, --help`
- 退出码 0

---

### 2.2 场景二：查看 CLI 版本

**角色**：开发者 / CI 脚本
**前置条件**：avfs 已安装

**操作步骤**：
1. 执行 `avfs --version` 或 `avfs -V`
2. 系统输出版本号

**预期结果**：
- 输出当前版本号（如 `0.1.0`）
- 仅版本号字符串，不含额外信息
- 退出码 0

---

### 2.3 场景三：尝试未实现命令

**角色**：开发者（探索 avfs 功能）
**前置条件**：avfs 已安装

**操作步骤**：
1. 执行 `avfs fetch avfs://file/etc/hosts`
2. 系统输出 Mock 提示

**预期结果**：
- 终端输出：`⚠️  avfs fetch is planned but not yet implemented. See avfs help for available commands.`
- 退出码 0
- 同样适用于 `convert`、`stat`、`validate`、`plugin`、`credential` 及其子命令

---

### 2.4 场景四：输错命令

**角色**：开发者
**前置条件**：avfs 已安装

**操作步骤**：
1. 执行 `avfs fethc`（拼写错误）
2. 系统提示未知命令

**预期结果**：
- commander 输出 `error: unknown command 'fethc'`
- 建议相似命令：`(Did you mean fetch?)`
- 退出码 1（commander 默认）

---

### 2.5 场景五：开发者本地构建与测试

**角色**：项目开发者
**前置条件**：已 clone 仓库，Node.js >= 20 已安装

**操作步骤**：
1. `cd cli/`
2. `pnpm install` — 安装依赖
3. `pnpm build` — tsup 构建，输出 `dist/index.mjs` 和 `dist/index.cjs`
4. `pnpm test` — vitest 运行测试套件
5. `node dist/index.mjs --version` — 验证构建产物可执行

**预期结果**：
- `pnpm install` 成功安装 commander、tsup、vitest、typescript 等依赖
- `pnpm build` 在 `dist/` 生成 ESM + CJS 产物
- `pnpm test` 全部测试通过（help 输出验证、version 输出验证、Mock 命令提示验证）
- 构建产物可直接用 Node.js 执行

---

### 2.6 场景六：CI/CD 自动构建与发布

**角色**：GitHub Actions / 项目维护者
**前置条件**：GitHub 仓库已配置 `NPM_TOKEN` secret

**操作步骤**：

**CI 流水线（push 到 main 或 PR 时自动触发）**：
1. GitHub Actions 拉取代码
2. 在 20.x / 22.x / 24.x 三个 Node 版本上并行执行：
   - `pnpm install`
   - `pnpm lint`（如有 lint 脚本）
   - `pnpm test`
   - `pnpm build`
3. 任一版本失败则 CI 标红，阻止合并

**CD 流水线（推送 `v*` tag 时自动触发）**：
1. 推送 `git tag v0.1.0 && git push origin v0.1.0`
2. GitHub Actions 拉取代码
3. `pnpm install && pnpm build`
4. `pnpm publish --access public --no-git-checks`
5. 发布成功 → npm 上 `@avfs/avfs-cli` 版本更新

**预期结果**：
- CI 全绿：3 个 Node 版本矩阵全部通过
- CD 成功：`npm info @avfs/avfs-cli` 可见最新版本
- 用户可执行 `pnpm install -g @avfs/avfs-cli` 安装

---

## 3. 技术方案

### 3.1 目录结构

```
cli/
├── package.json               # @avfs/avfs-cli, bin: avfs, engines.node >= 20
├── tsconfig.json               # ES2022, NodeNext, strict
├── tsup.config.ts              # ESM (.mjs) + CJS (.cjs) 双输出
├── .gitignore                  # node_modules/ + dist/
│
├── src/
│   ├── index.ts                # 入口：创建 Commander 实例, 注册命令, 启动解析
│   │
│   ├── commands/
│   │   ├── index.ts            # 批量注册：registerAllCommands(program)
│   │   ├── fetch.command.ts    # Mock: avfs fetch <address>
│   │   ├── convert.command.ts  # Mock: avfs convert <path>
│   │   ├── stat.command.ts     # Mock: avfs stat <address>
│   │   ├── validate.command.ts # Mock: avfs validate <address>
│   │   ├── plugin.command.ts   # Mock: avfs plugin <sub> [args]
│   │   └── credential.command.ts # Mock: avfs credential <sub> [args]
│   │
│   └── drivers/
│       ├── driver.interface.ts # Driver 统一接口 (connect/read/stat/close)
│       ├── file.driver.ts      # file 协议 — 空实现
│       ├── http.driver.ts      # http 协议 — 空实现
│       ├── https.driver.ts     # https 协议 — 空实现
│       ├── smb.driver.ts       # smb 协议 — 空实现
│       └── git.driver.ts       # git 协议 — 空实现
│
└── test/
    ├── index.test.ts           # help / version 输出验证
    └── commands.test.ts        # Mock 命令提示验证
```

### 3.2 构建管线

**`cli/tsup.config.ts`**：

| 配置项 | 值 |
|--------|-----|
| `entry` | `src/index.ts` |
| `format` | `["esm", "cjs"]` |
| `outDir` | `dist` |
| `outExtension` | `{ ".js": ".mjs" }`（ESM）；`{ ".js": ".cjs" }`（CJS） |
| `dts` | `false`（CLI 工具不需要类型声明） |
| `clean` | `true`（构建前清理 dist/） |
| `shims` | `true`（CJS 兼容 shim） |

**`cli/tsconfig.json`**：

| 配置项 | 值 |
|--------|-----|
| `target` | `ES2022` |
| `module` | `NodeNext` |
| `moduleResolution` | `NodeNext` |
| `strict` | `true` |
| `outDir` | `dist` |
| `rootDir` | `src` |
| `esModuleInterop` | `true` |
| `skipLibCheck` | `true` |

### 3.3 命令注册模式

每个命令文件导出一个标准注册函数，`commands/index.ts` 批量调用：

```
fetch.command.ts ─┐
convert.command.ts ┤
stat.command.ts   ┼── commands/index.ts ── registerAllCommands(program)
validate.command.ts┤
plugin.command.ts  ┤
credential.command.ts┘
```

**注册函数签名**：

每个命令文件导出一个函数，接收 Commander `program` 实例，内部调用 `program.command()` 注册子命令及其处理逻辑。`index.ts` 导入全部注册函数并按序调用。

### 3.4 Mock 命令实现

所有未实现命令使用统一模式：

1. `program.command("<name>")` 定义命令名称、描述、参数
2. `.action(() => { ... })` 输出占位提示：
   ```
   ⚠️  avfs <command> is planned but not yet implemented.
   See avfs help for available commands.
   ```
3. 不调用 `process.exit(1)`，依赖 commander 默认退出码 0

**plugin / credential 子命令**：使用 commander 的 `.command()` 嵌套定义子命令（`list`、`load` 等），每个子命令注册独立的 Mock action。

### 3.5 Node 版本运行时检查

`src/index.ts` 入口顶部：

1. 读取 `process.versions.node` 获取主版本号
2. 若 `< 20`，输出 `avfs requires Node.js >= 20 (current: v<version>)` 并 `process.exit(1)`
3. 通过后继续 commander 初始化

`package.json` 中 `"engines": { "node": ">=20" }` 提供安装时的静态声明。

---

## 4. 接口设计

### 4.1 Driver 接口

```text
interface Driver {
  protocol: string;                                         // 协议标识符
  connect(resourceBase: string, options?: ConnectOptions): Promise<void>;
  read(filePath: string): Promise<ReadableStream<Uint8Array>>;
  stat(filePath: string): Promise<FileMetadata>;
  close(): Promise<void>;
}
```

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `connect` | `resourceBase: string`, `options?: ConnectOptions` | `Promise<void>` | 建立到资源基址的连接 |
| `read` | `filePath: string` | `Promise<ReadableStream>` | 读取文件的原始二进制流 |
| `stat` | `filePath: string` | `Promise<FileMetadata>` | 获取文件元数据（大小、类型、修改时间） |
| `close` | — | `Promise<void>` | 释放连接资源 |

**FT-001 阶段**：5 个驱动文件均为空类实现，所有方法 `throw new Error("Not implemented")`。接口定义完整，为后续实现提供契约约束。

### 4.2 命令注册约定

每个命令文件遵循统一导出模式。commander 的 `program.command()` 直接处理参数解析和帮助文本生成，不需要额外抽象层。`commands/index.ts` 导入所有命令注册函数并遍历调用。

---

## 5. 数据模型

### 5.1 核心类型定义

FT-001 阶段仅定义接口类型，不包含运行时数据结构：

| 类型 | 字段 | 说明 |
|------|------|------|
| `Driver` | `protocol`, `connect()`, `read()`, `stat()`, `close()` | 驱动统一接口 |
| `ConnectOptions` | `credentials?: Record<string,string>`, `timeout?: number` | 连接可选参数 |
| `FileMetadata` | `size: number`, `mimeType: string`, `modifiedAt: Date`, `protocol: string` | 文件元数据 |
| `CommandContext` | — | 占位类型，后续扩展（FT-001 中不使用） |

所有类型定义使用 TypeScript `interface`（非 `type`），便于后续扩展和声明合并。

---

## 6. 依赖关系

### 6.1 运行时依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `commander` | `^14.0.0` | CLI 参数解析与子命令分发 |

仅 commander 一个运行时依赖，保持包体积最小。

### 6.2 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `typescript` | `^5.8.0` | 类型检查与编译 |
| `tsup` | `^8.5.0` | 构建打包（ESM + CJS 双输出） |
| `vitest` | `^3.2.0` | 单元测试框架 |
| `@types/node` | `^22.0.0` | Node.js 类型定义 |

### 6.3 NPM Scripts

| 命令 | 内容 | 说明 |
|------|------|------|
| `build` | `tsup` | 构建 dist/，产出 ESM + CJS |
| `dev` | `tsup --watch` | 开发模式，文件变更自动重构建 |
| `test` | `vitest run` | 单次运行全部测试 |
| `test:watch` | `vitest` | 持续监听模式 |
| `prepublishOnly` | `pnpm build` | npm publish 前自动构建 |

**lint 暂不纳入 FT-001**：ESLint + Prettier 配置在后续特性中单独添加。

---

## 7. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|:--:|----------|
| commander.js API 版本不兼容 | 命令注册代码需修改 | 低 | 锁定 `^14.0.0` 主版本，大版本升级独立评估 |
| tsup ESM/CJS 双输出出现构建错误 | 产物缺失或运行异常 | 低 | CI 矩阵 3 个 Node 版本全量验证，构建后执行 smoke test |
| `@avfs` npm scope 被占用 | 无法发布公开包 | 低 | 提前验证 scope 所有权；若占用则备选 `@avfs-io/avfs-cli` |
| Node 20 EOL 后安全风险 | 最低引擎版本过时 | 中 | 定期审查 LTS 状态，必要时提升最低版本并发布 breaking change |
| 驱动接口在后续拆分时设计变更 | 迁移成本增加 | 中 | 接口定义遵循架构文档契约，只做最小必需的抽象 |

---

## 8. 验收条件 (DoD)

> **状态说明**：
> - **已完成**：✅
> - **部分完成**：🟡
> - **待实现**：❌

### 8.1 核心功能

| 编号 | 完成点 | 说明 | 状态 |
|:----:|---------|------|:----:|
| 8.1.1 | `avfs` 无参数执行 | 输出完整 help 信息，列出全部子命令和全局选项 | ✅ |
| 8.1.2 | `avfs --help` / `avfs -h` | 输出帮助，同无参数行为 | ✅ |
| 8.1.3 | `avfs --version` / `avfs -V` | 输出纯版本号字符串（如 `0.1.0`） | ✅ |
| 8.1.4 | `avfs fetch <address>` | 输出 Mock 提示 | ✅ |
| 8.1.5 | `avfs convert <path>` | 输出 Mock 提示 | ✅ |
| 8.1.6 | `avfs stat <address>` | 输出 Mock 提示 | ✅ |
| 8.1.7 | `avfs validate <address>` | 输出 Mock 提示 | ✅ |
| 8.1.8 | `avfs plugin <sub>` | `list`/`load`/`unregister` 子命令均输出 Mock 提示 | ✅ |
| 8.1.9 | `avfs credential <sub>` | `set`/`list`/`revoke`/`load` 子命令均输出 Mock 提示 | ✅ |
| 8.1.10 | 输入未知命令 | commander 默认 "unknown command" + 相似建议 | ✅ |
| 8.1.11 | Node < 20 运行时 | 输出 "avfs requires Node.js >= 20" 并退出码 1 | ✅ |
| 8.1.12 | Driver 接口定义 | 5 个驱动文件 + 统一接口文件全部创建 | ✅ |
| 8.1.13 | `pnpm build` 成功 | tsup 输出 `dist/index.mjs` + `dist/index.cjs` | ✅ |
| 8.1.14 | `pnpm test` 全部通过 | vitest 覆盖 help/version/Mock 命令输出 | ✅ |

### 8.2 CI/CD

| 编号 | 完成点 | 说明 | 状态 |
|:----:|---------|------|:----:|
| 8.2.1 | CI 流水线 `avfs-cli-ci.yml` | push/PR 触发，20.x/22.x/24.x 矩阵，install → build → test | ✅ |
| 8.2.2 | CD 流水线 `avfs-cli-publish.yml` | v* tag 触发，build → `pnpm publish --access public` | ✅ |
| 8.2.3 | `NPM_TOKEN` secret | GitHub Secrets 配置完成后 CD 可成功发布 | ✅ |

### 8.3 非功能需求

| 编号 | 完成点 | 说明 | 状态 |
|:----:|---------|------|:----:|
| 8.3.1 | 安装即用 | `npm install -g @avfs/avfs-cli` 后直接可执行 `avfs` | ✅ |
| 8.3.2 | `dist/` 不入库 | `.gitignore` 忽略构建产物 | ✅ |
| 8.3.3 | `prepublishOnly` 钩子 | `pnpm publish` 前自动执行 `pnpm build` | ✅ |
