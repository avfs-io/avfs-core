# FT-001 CLI 基础框架 实施计划

> **🔗 前置依赖**：本文档基于 [FT-001-cli-foundation-PRD.md](./FT-001-cli-foundation-PRD.md)（产品需求文档）拆解生成。

> 最后更新：2026-05-24

> **📋 开发进度**：[develop-log.json](./develop-log.json) — 任务执行状态与历史记录（由 `/qahc-harness-develop` 驱动更新）

---

## 项目概述

从零搭建 AVFS CLI 工具 `@avfs/avfs-cli` 的基础骨架：建立 TypeScript 项目结构、实现 commander.js 驱动的命令系统（help/version 完整实现 + 6 组 Mock 子命令）、定义 Driver 统一接口与 5 类协议空实现、建立 vitest 测试覆盖、配置 GitHub Actions CI/CD 流水线。

### 前置依赖

- 无（AVFS 项目首个开发特性）

### 后续依赖

- FT-002+: 各子命令的真实实现（fetch/convert/stat/validate/plugin/credential）
- FT-0xx: 驱动实现拆分到独立 `driver/` 目录

---

## 进度概要

| Phase | 任务 | 状态 | 交付物 |
| :----: | ------ | :----: | ------ |
| 1 | 项目配置初始化 | ✅ | package.json, tsconfig.json, tsup.config.ts, .gitignore |
| 1 | CLI 入口与 help/version | ✅ | src/index.ts, 命令注册框架, pnpm build 可执行 |
| 2 | 6 组 Mock 命令 | ✅ | fetch/convert/stat/validate/plugin/credential 命令文件 |
| 2 | Node 版本检查 | ✅ | 入口文件顶部版本检查 + engines 声明 |
| 3 | Driver 接口与空实现 | ✅ | driver.interface.ts + 5 个协议驱动文件 |
| 4 | vitest 测试 | ✅ | test/ 下测试文件, pnpm test 全部通过 |
| 4 | CI 流水线 | ✅ | avfs-cli-ci.yml |
| 4 | CD 流水线 | ✅ | avfs-cli-publish.yml |

---

## Phase 1: 项目骨架与 CLI 入口

### 目标

建立可构建、可执行的 CLI 最小骨架。完成后 `pnpm build && node dist/index.mjs --version` 输出 `0.1.0`，`avfs --help` 列出全部命令骨架。

### 任务 1.1: 项目配置初始化

#### 工程属性

| 属性 | 值 |
|------|-----|
| 包名 | `@avfs/avfs-cli` |
| 包路径 | `cli/` |
| 运行时 | Node.js >= 20 |
| 模块系统 | ESM (`"type": "module"`) |
| 包管理器 | pnpm |

#### 核心逻辑

1. 创建 `cli/package.json`：设置 `name`、`version: "0.1.0"`、`"type": "module"`、`bin: { "avfs": "./dist/index.mjs" }`、`engines: { "node": ">=20" }`、`scripts`（build/dev/test/prepublishOnly）
2. 创建 `cli/tsconfig.json`：target ES2022、module NodeNext、moduleResolution NodeNext、strict true、rootDir src、outDir dist
3. 创建 `cli/tsup.config.ts`：entry src/index.ts、format ["esm","cjs"]、outDir dist、outExtension 分别映射 .js→.mjs/.cjs、clean true
4. 创建 `cli/.gitignore`：忽略 node_modules/ 和 dist/

#### 交付物

- `cli/package.json`
- `cli/tsconfig.json`
- `cli/tsup.config.ts`
- `cli/.gitignore`

#### 验证步骤

- [x] **V1.1.1** ✅ 检查 package.json 存在且字段正确 → `"name": "@avfs/avfs-cli"`, `"type": "module"`, `"bin": { "avfs": "./dist/index.mjs" }`
  `cat cli/package.json | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.name, j.type, j.bin.avfs, j.engines.node)"`
- [x] **V1.1.2** ✅ 检查 tsconfig.json 存在 → target ES2022, module NodeNext, strict true
  `cat cli/tsconfig.json | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.compilerOptions.target, j.compilerOptions.module, j.compilerOptions.strict)"`
- [x] **V1.1.3** ✅ 检查 tsup.config.ts 存在 → entry src/index.ts, format ["esm","cjs"]
  `ls cli/tsup.config.ts && grep -q "src/index.ts" cli/tsup.config.ts && grep -q '"esm"' cli/tsup.config.ts && echo "OK"`
- [x] **V1.1.4** ✅ 检查 .gitignore 忽略 dist/ 和 node_modules/
  `grep -q "dist" cli/.gitignore && grep -q "node_modules" cli/.gitignore && echo "OK"`

### 任务 1.2: CLI 入口与 version

#### 工程属性

| 属性 | 值 |
|------|-----|
| 入口文件 | `cli/src/index.ts` |
| CLI 框架 | commander.js `^14.0.0` |

#### 核心逻辑

1. `pnpm install` 安装 commander + typescript + tsup + @types/node（开发依赖）
2. 创建 `cli/src/index.ts`：
   - 从 `package.json` 读取 version（`--version` 输出仅版本号）
   - 创建 Commander 程序实例，设置 `.name("avfs").version(...).description(...)`
   - 调用命令注册器（预留，任务 1.3 实现）
   - `program.parse(process.argv)`
3. `pnpm build` 通过 tsup 构建出 `dist/index.mjs` + `dist/index.cjs`

#### 交付物

- `cli/src/index.ts`
- `cli/package.json`（含更新后的 devDependencies）
- `cli/dist/index.mjs`（构建产物）

#### 验证步骤

- [x] **V1.2.1** ✅ pnpm install 成功安装依赖
  `cd cli && pnpm install`
- [x] **V1.2.2** ✅ pnpm build 成功生成 dist/
  `cd cli && pnpm build && ls dist/index.mjs dist/index.cjs`
- [x] **V1.2.3** ✅ node dist/index.mjs --version 输出 0.1.0
  `cd cli && node dist/index.mjs --version`
- [x] **V1.2.4** ✅ node dist/index.mjs -V 输出 0.1.0
  `cd cli && node dist/index.mjs -V`
- [x] **V1.2.5** ✅ node dist/index.mjs --help 输出帮助（无已注册子命令时仅显示全局选项）
  `cd cli && node dist/index.mjs --help`

### 任务 1.3: 命令注册框架

#### 核心逻辑

1. 创建 `cli/src/commands/index.ts`：
   - 导出 `registerAllCommands(program: Command)` 函数
   - 内部预留导入各命令注册函数的位置（Phase 2 填充）
2. 更新 `cli/src/index.ts`：在 `program.parse()` 前调用 `registerAllCommands(program)`
3. 此时 help 应能显示即将存在的子命令占位（Phase 2 填充后生效）

#### 交付物

- `cli/src/commands/index.ts`

#### 验证步骤

- [x] **V1.3.1** ✅ commands/index.ts 导出 registerAllCommands 函数
  `grep -q "export.*registerAllCommands" cli/src/commands/index.ts && echo "OK"`
- [x] **V1.3.2** ✅ index.ts 调用 registerAllCommands
  `grep -q "registerAllCommands" cli/src/index.ts && echo "OK"`
- [x] **V1.3.3** ✅ pnpm build 成功（新增文件不破坏构建）
  `cd cli && pnpm build`

---

## Phase 2: Mock 命令与边界处理

### 目标

全部 6 组子命令可被用户执行并返回友好 Mock 提示。不支持的 Node 版本有明确错误信息。

### 任务 2.1: 6 组 Mock 命令

#### 核心逻辑

1. 创建每个命令文件，实现统一 Mock 模式：
   - `program.command("<name>").description("...").argument("<arg>", "...").action(() => { console.log("⚠️  avfs <name> is planned but not yet implemented. See avfs help for available commands.") })`
2. 创建的命令文件：
   - `fetch.command.ts` — `avfs fetch <address>`
   - `convert.command.ts` — `avfs convert <path>`
   - `stat.command.ts` — `avfs stat <address>`
   - `validate.command.ts` — `avfs validate <address>`
   - `plugin.command.ts` — `avfs plugin <sub>`（子命令 list/load/unregister，均为 Mock）
   - `credential.command.ts` — `avfs credential <sub>`（子命令 set/list/revoke/load，均为 Mock）
3. 更新 `commands/index.ts`：导入所有命令注册函数并按序调用

#### 交付物

- `cli/src/commands/fetch.command.ts`
- `cli/src/commands/convert.command.ts`
- `cli/src/commands/stat.command.ts`
- `cli/src/commands/validate.command.ts`
- `cli/src/commands/plugin.command.ts`
- `cli/src/commands/credential.command.ts`
- `cli/src/commands/index.ts`（更新）

#### 验证步骤

- [x] **V2.1.1** ✅ pnpm build 成功
  `cd cli && pnpm build`
- [x] **V2.1.2** ✅ avfs fetch 输出 Mock 提示
  `cd cli && node dist/index.mjs fetch test | grep "planned but not yet implemented"`
- [x] **V2.1.3** ✅ avfs convert 输出 Mock 提示
  `cd cli && node dist/index.mjs convert test | grep "planned but not yet implemented"`
- [x] **V2.1.4** ✅ avfs stat 输出 Mock 提示
  `cd cli && node dist/index.mjs stat test | grep "planned but not yet implemented"`
- [x] **V2.1.5** ✅ avfs validate 输出 Mock 提示
  `cd cli && node dist/index.mjs validate test | grep "planned but not yet implemented"`
- [x] **V2.1.6** ✅ avfs plugin list 输出 Mock 提示
  `cd cli && node dist/index.mjs plugin list | grep "planned but not yet implemented"`
- [x] **V2.1.7** ✅ avfs credential set 输出 Mock 提示
  `cd cli && node dist/index.mjs credential set key value | grep "planned but not yet implemented"`
- [x] **V2.1.8** ✅ avfs --help 列出全部 6 组命令
  `cd cli && node dist/index.mjs --help | grep -E "fetch|convert|stat|validate|plugin|credential"`

### 任务 2.2: Node 版本运行时检查

#### 核心逻辑

1. 在 `cli/src/index.ts` 顶部（commander 初始化前）添加：
   - 读取 `process.versions.node` 解析主版本号
   - 若 < 20，输出 `avfs requires Node.js >= 20 (current: v<version>)` 并 `process.exit(1)`
2. 确认 `package.json` 中已有 `"engines": { "node": ">=20" }`（任务 1.1 已设置）

#### 交付物

- `cli/src/index.ts`（更新）

#### 验证步骤

- [x] **V2.2.1** ✅ package.json engines 字段声明 >=20
  `cat cli/package.json | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.engines.node)"`
- [x] **V2.2.2** ✅ pnpm build 成功
  `cd cli && pnpm build`
- [x] **V2.2.3** ✅ 当前 Node 版本 >= 20 正常执行
  `cd cli && node -e "require('./dist/index.cjs')" 2>&1; node dist/index.mjs --version`
- [x] **V2.2.4** ✅ 版本检查代码存在（index.ts 含 process.versions.node 检查逻辑）
  `grep -q "process.versions.node" cli/src/index.ts && echo "OK"`

---

## Phase 3: 驱动接口

### 目标

定义 Driver 统一接口契约，创建 5 类内置协议的空实现骨架。

### 任务 3.1: Driver 接口与空实现

#### 核心逻辑

1. 创建 `cli/src/drivers/driver.interface.ts`：定义 `Driver` interface，包含 `protocol: string`、`connect()`、`read()`、`stat()`、`close()` 方法签名
2. 为每个协议创建空实现文件，每个文件导出一个实现 Driver 接口的类：
   - `file.driver.ts` — protocol = `"file"`
   - `http.driver.ts` — protocol = `"http"`
   - `https.driver.ts` — protocol = `"https"`
   - `smb.driver.ts` — protocol = `"smb"`
   - `git.driver.ts` — protocol = `"git"`
3. 空实现中所有方法 `throw new Error("Not implemented")`
4. 各文件间无相互依赖，只依赖 `driver.interface.ts`

#### 交付物

- `cli/src/drivers/driver.interface.ts`
- `cli/src/drivers/file.driver.ts`
- `cli/src/drivers/http.driver.ts`
- `cli/src/drivers/https.driver.ts`
- `cli/src/drivers/smb.driver.ts`
- `cli/src/drivers/git.driver.ts`

#### 验证步骤

- [x] **V3.1.1** ✅ pnpm build 成功（驱动文件编译通过）
  `cd cli && pnpm build`
- [x] **V3.1.2** ✅ driver.interface.ts 定义 Driver, ConnectOptions, FileMetadata 类型
  `grep -q "interface Driver" cli/src/drivers/driver.interface.ts && grep -q "interface ConnectOptions" cli/src/drivers/driver.interface.ts && grep -q "interface FileMetadata" cli/src/drivers/driver.interface.ts && echo "OK"`
- [x] **V3.1.3** ✅ 5 个驱动文件全部存在
  `ls cli/src/drivers/file.driver.ts cli/src/drivers/http.driver.ts cli/src/drivers/https.driver.ts cli/src/drivers/smb.driver.ts cli/src/drivers/git.driver.ts`
- [x] **V3.1.4** ✅ 所有驱动文件 import Driver interface
  `for f in file http https smb git; do grep -q "import.*Driver.*from" cli/src/drivers/$f.driver.ts && echo "$f: OK"; done`

---

## Phase 4: 测试与 CI/CD

### 目标

建立自动化测试覆盖和 CI/CD 流水线，确保代码质量和自动化发布能力。

### 任务 4.1: vitest 测试

#### 工程属性

| 属性 | 值 |
|------|-----|
| 测试框架 | vitest `^3.2.0` |
| 测试目录 | `cli/test/` |

#### 核心逻辑

1. `pnpm add -D vitest` 安装测试依赖
2. 创建 `cli/test/index.test.ts`：测试 --version 输出、--help 输出格式
3. 创建 `cli/test/commands.test.ts`：测试全部 6 组命令返回 Mock 提示
4. 创建 `cli/test/drivers.test.ts`：测试驱动文件可导入且存在（不测试空实现功能）
5. 使用 vitest 的 `describe`/`it`/`expect` 编写测试
6. 保证 `pnpm test` 全部通过

#### 交付物

- `cli/test/index.test.ts`
- `cli/test/commands.test.ts`
- `cli/test/drivers.test.ts`

#### 验证步骤

- [x] **V4.1.1** ✅ pnpm test 全部通过
  `cd cli && pnpm test`
- [x] **V4.1.2** ✅ pnpm build 成功
  `cd cli && pnpm build`
- [x] **V4.1.3** ✅ 测试覆盖 --version 输出
  `cd cli && grep -q "version" test/index.test.ts && echo "OK"`
- [x] **V4.1.4** ✅ 测试覆盖 --help 输出
  `cd cli && grep -q "help" test/index.test.ts && echo "OK"`
- [x] **V4.1.5** ✅ 测试覆盖全部 6 组 Mock 命令
  `cd cli && for cmd in fetch convert stat validate plugin credential; do grep -q "$cmd" test/commands.test.ts && echo "$cmd: covered"; done`

### 任务 4.2: GitHub Actions CI 流水线

#### 配置要点

| 配置项 | 值 |
|--------|-----|
| 文件名 | `.github/workflows/avfs-cli-ci.yml` |
| 触发条件 | push 到 main + pull_request |
| Node 矩阵 | 20.x, 22.x, 24.x |
| 工作目录 | `cli/` |
| 执行步骤 | pnpm install → pnpm test → pnpm build |

#### 核心逻辑

1. 创建 `.github/workflows/` 目录
2. 编写 `avfs-cli-ci.yml`，使用 `actions/setup-node@v4` + pnpm（`corepack enable pnpm`）
3. 设置 `working-directory: cli`
4. 三阶段：install、test、build
5. 矩阵并行执行 3 个 Node 版本

#### 交付物

- `.github/workflows/avfs-cli-ci.yml`

#### 验证步骤

- [x] **V4.2.1** ✅ CI 工作流文件存在
  `ls .github/workflows/avfs-cli-ci.yml`
- [x] **V4.2.2** ✅ CI 触发条件为 push + pull_request
  `grep -A5 "on:" .github/workflows/avfs-cli-ci.yml | grep -E "push|pull_request"`
- [x] **V4.2.3** ✅ CI 含 3 个 Node 版本矩阵（20.x, 22.x, 24.x）
  `grep -E "20.x|22.x|24.x" .github/workflows/avfs-cli-ci.yml | wc -l`
- [x] **V4.2.4** ✅ CI 步骤含 pnpm install/test/build
  `grep -q "pnpm install\|pnpm test\|pnpm build" .github/workflows/avfs-cli-ci.yml && echo "OK"`
- [x] **V4.2.5** ✅ CI working-directory 指向 cli/
  `grep -q "working-directory.*cli" .github/workflows/avfs-cli-ci.yml && echo "OK"`

### 任务 4.3: GitHub Actions CD 流水线

#### 配置要点

| 配置项 | 值 |
|--------|-----|
| 文件名 | `.github/workflows/avfs-cli-publish.yml` |
| 触发条件 | push tag 匹配 `v*` |
| 工作目录 | `cli/` |
| 执行步骤 | pnpm install → pnpm build → pnpm publish --access public |

#### 核心逻辑

1. 编写 `avfs-cli-publish.yml`
2. 使用 `actions/setup-node@v4` + pnpm，配置 `registry-url: https://registry.npmjs.org`
3. publish 步骤使用 `NPM_TOKEN` secret
4. 发布命令：`pnpm publish --access public --no-git-checks`

#### 交付物

- `.github/workflows/avfs-cli-publish.yml`

#### 验证步骤

- [x] **V4.3.1** ✅ CD 工作流文件存在
  `ls .github/workflows/avfs-cli-publish.yml`
- [x] **V4.3.2** ✅ CD 触发条件为 v* tag
  `grep -A5 "on:" .github/workflows/avfs-cli-publish.yml | grep "v"`
- [x] **V4.3.3** ✅ CD 含 NPM_TOKEN secret 引用
  `grep "NPM_TOKEN" .github/workflows/avfs-cli-publish.yml`
- [x] **V4.3.4** ✅ CD 发布命令含 --access public
  `grep "access public" .github/workflows/avfs-cli-publish.yml`
- [x] **V4.3.5** ✅ CD working-directory 指向 cli/
  `grep -q "working-directory.*cli" .github/workflows/avfs-cli-publish.yml && echo "OK"`

---

## 实施顺序建议

1. **Phase 1 (任务 1.1 → 1.2 → 1.3)**：项目骨架 → CLI 入口 → 命令注册框架（严格顺序，每步依赖前一步）
2. **Phase 2 (任务 2.1 → 2.2)**：Mock 命令 → Node 版本检查（建议顺序，可并行但风险低无需）
3. **Phase 3 (任务 3.1)**：驱动接口（独立，可在 Phase 2 完成后或并行执行）
4. **Phase 4 (任务 4.1 → 4.2 → 4.3)**：测试 → CI → CD（测试需 Phase 2/3 完成后编写；CI/CD 可并行）

### 关键依赖链

```
1.1 项目配置
 └─ 1.2 CLI 入口
     └─ 1.3 命令注册框架
         └─ 2.1 Mock 命令
             ├─ 2.2 Node 检查
             ├─ 3.1 驱动接口
             └─ 4.1 测试 (需 2.1 + 3.1 完成后)
                 └─ 4.2 CI (需 4.1 测试通过)
                 └─ 4.3 CD (需 4.1 测试通过)
```

---

## 风险与挑战

| 风险 | 影响 | 应对措施 |
| ------ | ------ | ---------- |
| commander.js API 差异 | 命令注册代码需调整 | 阅读 commander v14 CHANGELOG，优先使用 v14 稳定 API |
| tsup ESM/CJS 双输出构建错误 | 产物缺失 | CI 矩阵 3 个 Node 版本验证；Priority 高，Phase 1 必须通过 |
| `@avfs` npm scope 未注册 | 无法发布 | 上线前确认 scope 所有权；未注册时按 npm 流程申请 |
| vitest ESM 配置 | 测试不能运行 | 使用 vitest 默认零配置，确认 `"type": "module"` 兼容 |

---

## 变更模块总览

| 变更模块 | 涉及 Phase | 核心变更 |
| ---------- | :--------: | ---------- |
| `cli/package.json` | 1, 2, 3, 4 | 包配置、依赖声明、scripts、engines |
| `cli/tsconfig.json` | 1 | TypeScript 编译配置 |
| `cli/tsup.config.ts` | 1 | 构建配置（ESM + CJS） |
| `cli/.gitignore` | 1 | 忽略规则 |
| `cli/src/index.ts` | 1, 2 | CLI 入口、commander 初始化、版本检查 |
| `cli/src/commands/` | 1, 2 | 命令注册框架 + 6 个命令文件 |
| `cli/src/drivers/` | 3 | 接口定义 + 5 个空实现 |
| `cli/test/` | 4 | vitest 测试套件 |
| `.github/workflows/` | 4 | CI + CD 流水线 |
