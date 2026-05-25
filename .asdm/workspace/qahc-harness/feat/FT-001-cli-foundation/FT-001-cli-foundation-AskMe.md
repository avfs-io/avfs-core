# FT-001 CLI 基础框架 — 需求访谈追问

> 本文档记录对 FT-001 CLI 基础框架特性的逐问题追问，用于澄清需求模糊点后制定最终需求规格。

**创建日期**：2026-05-24
**负责人**：Lei Xu
**状态**：已完成

---

## 背景摘要

AVFS 项目当前处于**规范先行、代码空白**阶段。`cli/`、`core/`、`driver/` 等关键目录均仅有 README 规划，没有任何实现代码。本项目需从零搭建 CLI 工具的基础骨架，作为后续所有功能开发的起点。

### 核心价值

- **建立可运行的 CLI 入口**：让 `avfs` 命令可被实际执行，输出 help 和 version 信息
- **为所有子命令预置 Mock 入口**：为 fetch/convert/stat/validate/plugin/credential 6 组子命令建立骨架注册，当前阶段返回占位提示，降低后续开发接入成本
- **Driver 集中管理**：在项目启动阶段，将 5 类内置驱动（file/http/https/smb/git）的接口定义和空实现集中在 CLI 包内，避免初期多包依赖管理的复杂性，后续再拆分到独立 `driver/` 目录

### 变更范围

| 变更模块 | 变更内容 |
| ---------- | ---------- |
| `cli/` | 从零搭建 TypeScript CLI 项目骨架：package.json、tsconfig.json、构建配置、入口文件、命令注册、help/version 实现、Mock 命令骨架 |
| `cli/src/drivers/` | 5 类驱动接口定义 + 空实现（暂存于 CLI 内，后续拆分到 `driver/`） |
| `.github/workflows/` | GitHub Actions CI/CD：`avfs-cli-ci.yml`（CI）+ `avfs-cli-publish.yml`（CD）自动流水线 |

### 初始需求

> 构建 avfs cli 的基础框架，为所有指令构建 Mock 入口，只实现 help 和 version。为了简化项目开发启动阶段，所有的 driver 部分也先集中在 cli 中进行实现，后续再拆分。另外，需要完成 GitHub Actions 自动打包和发布到 npm 的 CI/CD 流程。

---

## 决策点

### 决策点 1：CLI 技术栈确认

**问题**：CLI 工具使用什么语言、运行时和 CLI 框架？

**背景**：
- `cli/README.md` 已规划技术选型为 **TypeScript + Node.js >= 18 + commander.js + tsup**
- 当前项目没有任何代码，需要首次选定并落实技术栈
- commander.js 是 Node.js 生态最成熟的 CLI 框架（下载量 2 亿+/周），tsup 是 esbuild 驱动的零配置 TypeScript 打包工具

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | TypeScript + commander.js + tsup（按 README 规划） | 与现有规划一致；commander 社区成熟、文档完善；tsup 构建速度快 | 无 |
| B | TypeScript + yargs + tsup | yargs 功能更丰富 | 与现有规划不一致，学习成本略高 |
| C | Rust + clap | 性能极致，单二进制分发 | 与项目 TS 技术栈不一致，团队技能要求高 |

**推荐**：✅ 选项 A — TypeScript + commander.js + tsup，落实 `cli/README.md` 的既定技术选型

**确认理由**：
1. 与 `cli/README.md` 规划一致，避免重复设计
2. commander.js 生态成熟、TS 类型支持完善，社区活跃
3. tsup 开箱即用，零配置即可产出 ESM/CJS 双格式

**状态**：⏳ 待确认

---

### 决策点 2：Node.js 版本与模块系统

**问题**：CLI 工具最低支持的 Node.js 版本和模块系统？

**背景**：
- `cli/README.md` 规划 Node.js >= 18 LTS
- 实际 2026 年 5 月状态：18 已 EOL（2025-04），20 刚 EOL（2026-04），22 为 Active LTS，24 为 Current
- 18 已停止安全更新超过一年，不适合作为新项目的最低版本
- 模块系统选择影响包配置、构建产物、下游兼容性
- CJS 兼容性已由 tsup 双输出（决策 11）覆盖

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | Node.js >= 20，纯 ESM（`"type": "module"`） | 跟上 LTS 节奏，覆盖绝大多数活跃用户，与 `NodeNext` 一致 | 放弃 18 存量用户 |
| B | Node.js >= 18，纯 ESM | 覆盖更广 | 18 已 EOL 超一年，安全支持已停止 |
| C | Node.js >= 22，纯 ESM | 只运行在当前 Active LTS | 20 存量用户被排除 |

**推荐**：✅ 选项 A — Node.js >= 20，纯 ESM（修正自原推 18）

**确认理由**：
1. 2026 年 Node 18 已 EOL 超一年（2025-04 结束），20 刚 EOL 一个月社区仍有大量存量用户，设为底线合理
2. 纯 ESM 源文件编写，tsup 构建时自动产出 CJS 产物（决策 11 已覆盖兼容性）
3. 22 作为 Active LTS 覆盖未来 2 年，24 是 Current，CI 矩阵覆盖 20/22/24 确保全 LTS 兼容

**状态**：✅ 已确认

---

### 决策点 3：包管理器

**问题**：使用哪个包管理器？

**背景**：
- `cli/README.md` 规划使用 npm，发布包为 `@avfs/avfs-cli`
- npm/pnpm/yarn 均可完成相同任务
- pnpm 使用内容寻址存储 + 符号链接，磁盘效率最高，严格依赖杜绝幽灵依赖

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | npm | 零额外安装，与 README 一致 | 幽灵依赖风险，磁盘占用高 |
| B | pnpm | 磁盘效率高，安装快，严格依赖解析 | 需额外安装（`corepack enable`） |
| C | yarn | Berry PnP 模式先进 | 生态兼容性偶有问题 |

**推荐**：✅ 选项 B — pnpm（由用户指定，修正自原推 npm）

**确认理由**：
1. 用户偏好 pnpm
2. 严格依赖避免幽灵依赖 bug
3. 全局硬链接 + 符号链接，多项目磁盘共享效率最高
4. 后续 monorepo 扩展时 pnpm workspaces 功能最成熟

**状态**：✅ 已确认

---

### 决策点 4：测试框架

**问题**：CLI 项目使用什么测试框架？

**背景**：
- `cli/README.md` 规划了 `test/commands/`、`test/lib/`、`test/fixtures/` 目录
- 当前项目无测试代码，需要选定测试框架
- CLI 测试通常包含单元测试（命令逻辑）和集成测试（执行二进制验证输出）

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | vitest | 速度极快，原生 ESM/TS 支持，与 Vite 生态一致 | 相对年轻 |
| B | jest + ts-jest | 生态最成熟，社区资源最多 | 配置复杂，ESM 支持需额外处理 |
| C | Node.js 原生 test runner (`node:test`) | 零依赖，Node 18+ 内置 | 功能较基础，断言能力有限 |

**推荐**：✅ 选项 A — vitest，原生 ESM/TS 支持，零配置启动，速度快

**确认理由**：
1. 原生 ESM + TypeScript 支持，与 ESM 模块系统天然匹配
2. 零配置即可运行 `.test.ts` 文件
3. 兼容 jest API，迁移成本低

**状态**：⏳ 待确认

---

### 决策点 5：Mock 命令行为

**问题**：6 组 Mock 子命令（fetch/convert/stat/validate/plugin/credential）应输出什么？

**背景**：
- 用户需求：为所有指令构建 Mock 入口，只实现 help 和 version
- Mock 命令需要有占位行为，既告知用户"功能规划中"，又不能静默失败
- 可考虑输出统一格式的提示信息，或返回特定退出码

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 输出 "⚠️  `avfs <command>` is planned but not yet implemented. See `avfs help` for available commands." 并退出码 0 | 信息明确，用户友好 | 退出码 0 可能让脚本误判为成功 |
| B | 同上提示信息，退出码 1（非零） | 明确表示功能不可用，脚本可检测 | 对交互式用户略显"报错" |
| C | 输出简洁的 JSON（`{"status":"not_implemented","command":"<name>"}`）+ 退出码 1 | 机器友好 | 交互式用户不友好 |

**推荐**：✅ 选项 A — 友好的文本提示 + 退出码 0，适合早期开发阶段手动交互

**确认理由**：
1. FT-001 阶段面向开发者手动验证，不是 CI/脚本场景
2. 提示信息引导用户查看 `avfs help`，降低困惑
3. 后续实现时替换为真实逻辑，无需修改退出码约定

**状态**：⏳ 待确认

---

### 决策点 6：Driver 接口在 CLI 内的组织方式

**问题**：5 类内置驱动的接口定义和空实现如何在 CLI 目录内组织？

**背景**：
- 用户需求：driver 部分先集中在 cli 中实现，后续再拆分到独立 `driver/` 目录
- `cli/README.md` 规划的目录结构中不包含 `src/drivers/`
- 需要设计一个清晰的目录结构，便于后续拆分时迁移
- 根据架构文档，Driver 接口包含 `connect`、`read`、`stat`、`close` 方法

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | `cli/src/drivers/` 目录，每个协议一个文件（`file.driver.ts`、`http.driver.ts` 等），共享 `driver.interface.ts` | 结构清晰，拆分时直接整体迁移 | 在当前阶段增加了目录层级 |
| B | 所有 Driver 定义集中在 `cli/src/drivers.ts` 单一文件 | 简单直接 | 拆分时需要重构，不利于独立迁移 |
| C | `cli/src/drivers/{file,http,https,smb,git}/` 子目录，每个含 `index.ts` + `types.ts` | 拆分粒度最细，扩展性最好 | 初期过度设计，5 个空实现不需要子目录 |

**推荐**：✅ 选项 A — `cli/src/drivers/` 扁平目录，一协议一文件 + 共享接口

**确认理由**：
1. 结构清晰且不过度设计——5 个协议各一个文件
2. 共享接口放在独立文件中，驱动文件各自实现
3. 后续拆分到 `driver/` 时直接整体迁移目录，无需重构内部结构

**状态**：⏳ 待确认

---

### 决策点 7：命令注册模式

**问题**：6 组子命令采用什么注册模式？

**背景**：
- `cli/README.md` 规划每个命令独立文件（`fetch.command.ts` 等），通过 `commands/index.ts` 统一注册
- 当前阶段所有命令都是 Mock + help/version，命令文件内容很少

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 按规划：每个命令独立文件 → `commands/index.ts` 批量注册 | 结构一致，后续实现时直接替换文件内容 | 当前每个文件仅 ~10 行 Mock 代码 |
| B | 单文件集中注册：所有 Mock 命令在 `index.ts` 中一次性定义 | 当前代码量最小 | 与 README 规划不一致，后续需重构拆分 |

**推荐**：✅ 选项 A — 按 `cli/README.md` 规划，每个命令独立文件 + 统一注册

**确认理由**：
1. 与 README 规划的结构一致，后续开发无需重构
2. 虽然当前每个文件代码量小，但提供了清晰的扩展点
3. 新增命令时只需新建文件 + 在 index.ts 注册一行

**状态**：⏳ 待确认

---

### 决策点 8：GitHub Actions 触发策略

**问题**：CI/CD 流水线在什么时机触发？自动发布到 npm 的触发条件是什么？

**背景**：
- 用户要求完成 "GitHub Actions 自动打包和发布到 npm 的流程"
- 典型的 CI/CD 分为两个阶段：**CI（持续集成）** 在每次 PR/push 时运行 lint + test + build 验证代码质量；**CD（持续交付）** 在满足条件时自动发布到 npm
- npm 发布需要 npm access token（`NPM_TOKEN`）作为 GitHub Secret
- 包名确认为 `@avfs/avfs-cli`

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | CI（lint+test+build）在 push 到 main 和 PR 时触发；CD（publish）仅在 push 新的 `v*` tag 时触发 | 发布时机明确，版本号由 tag 控制，CI/CD 分离清晰 | 需要手动打 tag 才能发布 |
| B | CI + CD 一体：push 到 main 时自动 lint → test → build，若通过则自动发布 | 全自动，无需手动干预 | 每次 push 都发布，版本号管理复杂 |
| C | CI 在 PR 时触发（含 lint+test+build）；CD 在 PR 合并到 main 时自动发布 | PR 合并即发布 | 没有显式版本控制点 |

**推荐**：✅ 选项 A — CI 在 push/PR 时运行 lint+test+build；CD 仅在 `v*` tag 推送时发布到 npm

**确认理由**：
1. 版本号由 Git tag（如 `v0.1.0`）显式控制，语义清晰，符合 SemVer
2. 日常 push 和 PR 仅验证代码质量，不触发发布
3. 这是 npm 生态最成熟的开源项目 CI/CD 模式（参考 commander.js、tsup 等项目）

**状态**：⏳ 待确认

---

### 决策点 9：GitHub Actions Node.js 版本矩阵

**问题**：CI 阶段在哪些 Node.js 版本上运行测试和构建？

**背景**：
- CLI 定位最低支持 Node.js >= 20（决策点 2 修正后）
- 2026 年 5 月实际 LTS 状态：20（维护中）、22（Active LTS）、24（Current）
- GitHub Actions 的 `actions/setup-node` 支持多版本矩阵策略
- 同时测试多个 Node 版本可保证兼容性

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅 Node.js 20.x | 最快，够用 | 未验证 22/24 兼容性 |
| B | Node.js 20.x、22.x、24.x 三个版本矩阵 | 覆盖当前全部活跃版本，及早发现兼容问题 | CI 时间略长（3x） |
| C | Node.js 20.x、22.x、24.x、latest | 覆盖未来版本 | 最新版不稳定，可能引入外部 CI 失败 |

**推荐**：✅ 选项 B — 20.x、22.x、24.x 三个版本矩阵（修正自原推 18/20/22）

**确认理由**：
1. 20 是决策点 2 确定的最低版本底线，22 是 Active LTS，24 是 Current
2. 及早发现 Node 版本兼容问题
3. 不使用 `latest` 避免非稳定版导致的虚假 CI 失败

**状态**：✅ 已确认

---

### 决策点 10：npm 发布范围与访问级别

**问题**：包发布到哪个 npm registry，访问级别如何设置？

**背景**：
- `cli/README.md` 规划包名为 `@avfs/cli`（scoped package）
- npm scoped packages 默认 private（需付费），需显式设置 `--access public`
- 项目许可证为 Apache 2.0，应为公开包

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 发布到 npm 公共 registry（`registry.npmjs.org`），`@avfs/avfs-cli` 公开访问 | 符合 Apache 2.0 开源定位，用户 `npm i -g @avfs/avfs-cli` 即可安装 | 需要在 org scope `@avfs` 下发布 |
| B | 发布到 GitHub Packages（`npm.pkg.github.com`） | 与 GitHub 生态集成紧密 | 需要额外配置 registry，用户安装不便 |

**推荐**：✅ 选项 A — npm 公共 registry，`@avfs/avfs-cli`，`--access public`

**确认理由**：
1. 开源项目天然应公开访问
2. 用户安装体验：`npm i -g @avfs/avfs-cli` 一条命令即可
3. 包名 `@avfs/avfs-cli` 由用户确认

**状态**：⏳ 待确认

---

### 决策点 11：构建产物规范

**问题**：CI/CD 构建产物的目标格式和输出路径？

**背景**：
- tsup 支持 ESM + CJS 双输出
- CLI 工具需要 `bin` 入口指向构建产物
- `cli/README.md` 规划构建产物发布为 npm 包（非 standalone binary）

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | tsup 双输出：`dist/index.mjs`（ESM）+ `dist/index.cjs`（CJS），`bin` 指向 ESM | 与 README 规划一致，兼容性好 | 两个产物文件 |
| B | 仅 ESM 输出：`dist/index.mjs` | 更简洁 | 无法被 CJS 项目 require（CLI 场景影响不大） |

**推荐**：✅ 选项 A — ESM + CJS 双输出，`bin` 指向 ESM

**确认理由**：
1. 与 `cli/README.md` 规划的 npm 包分发一致
2. tsup 零配置即可产出双格式
3. 保留 CJS 产物为后续 SDK 引用留有余地

**状态**：✅ 已确认

---

### 决策点 12：不支持的 Node.js 版本

**问题**：用户在 Node < 20 环境下运行 `avfs` 命令，应如何处理？

**背景**：
- 决策点 2 确定最低支持 Node.js >= 20
- 若用户以 Node 18 运行，可能遇到语法错误（如顶层 await），难以定位根因
- `package.json` 的 `engines` 字段可声明版本要求，pnpm 安装时打印 warning

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | `engines` 声明 + 运行时检测，输出 "avfs requires Node.js >= 20" 并退出 | 用户明确知道原因 | 需少量检查代码 |
| B | 仅 `engines` 声明，不做运行时检查 | 简单 | 低版本用户可能看到语法报错，困惑 |
| C | 不做任何限制 | 零成本 | 低版本用户无法定位问题 |

**推荐**：✅ 选项 A — `engines` 声明 + 运行时友好提示

**确认理由**：
1. `engines` 在 `package.json` 中声明 `"node": ">=20"`，pnpm install 时自动 warning
2. 入口文件顶部加一行检查，低于 20 则输出明确提示 + 退出码 1
3. 成本极低（~5 行代码），避免用户困惑和支持负担

**状态**：✅ 已确认

---

### 决策点 13：无效命令 / 未知子命令处理

**问题**：用户输入 `avfs unknown-cmd` 或 `avfs plugin unknown-sub` 时如何处理？

**背景**：
- commander.js 内置了 unknown command 处理，输出 "unknown command" + 建议相似命令
- 这是 npm 生态 CLI 工具的事实标准行为

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | commander 默认行为 | 零开发成本，行为标准 | 英文提示 |
| B | 覆盖为中文/自定义提示 | 用户友好 | 需额外配置 |

**推荐**：✅ 选项 A — commander 默认行为，已是主流 CLI 事实标准

**确认理由**：
1. 开发者用户习惯英文 CLI 输出
2. commander 内置相似命令建议，用户体验好
3. 零额外开发成本

**状态**：✅ 已确认

---

### 决策点 14：`avfs` 无参数运行时的行为

**问题**：用户直接执行 `avfs`（不带任何子命令和选项），应展示什么？

**背景**：
- commander 默认在无匹配命令时输出完整帮助信息

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | commander 默认：输出完整 help | 用户能立即看到所有可用命令 | — |
| B | Logo + 版本 + 简短提示 + 引导 `avfs --help` | 有品牌感 | 需自定义入口逻辑 |

**推荐**：✅ 选项 A — commander 默认 help，简洁实用

**确认理由**：
1. 与主流 CLI 工具行为一致（git、docker 等）
2. 零额外开发成本
3. FT-001 阶段不需要品牌化输出

**状态**：✅ 已确认

---

### 决策点 15：`--version` 输出内容

**问题**：`avfs --version` 应输出什么信息？

**背景**：
- commander 默认输出 `package.json` 中的 version 字段
- 扩展信息（Node 版本、平台）对排查问题有帮助，但影响脚本解析

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅版本号：`0.1.0` | 脚本友好 | 信息较少 |
| B | 扩展信息：`0.1.0 (Node v22.3.0, linux x64)` | 排查问题方便 | 脚本解析需额外处理 |

**推荐**：✅ 选项 A — 仅版本号，commander 默认行为，脚本友好

**确认理由**：
1. 与 npm 生态标准一致
2. 脚本/CI 中可直接 `avfs --version` 获取纯净版本号
3. 需要排查时可用 `node --version && uname -m` 单独获取

**状态**：✅ 已确认

---

### 决策点 16：GitHub Actions 发布失败处理

**问题**：CI 中 `pnpm publish` 失败如何处理？

**背景**：
- publish 失败原因多为硬错误（NPM_TOKEN 无效、版本号冲突），重试无意义

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 直接失败，不重试 | 简单 | 需人工介入 |
| B | 自动重试 1 次（间隔 30s） | 减少网络抖动误失败 | token 无效等硬错误也重试，浪费时间 |

**推荐**：✅ 选项 A — 直接失败，publish 失败需人工检查

**确认理由**：
1. publish 失败原因通常是 token 或版本号问题，重试不会自动解决
2. 保持 CI 流程简洁
3. 如确需重试，手动重新推送 tag 即可

**状态**：✅ 已确认

---

### 决策点 17：构建产物目录策略

**问题**：`dist/` 构建产物是否需要提交到 Git？

**背景**：
- tsup 构建输出到 `dist/` 目录
- 构建产物是否入库影响仓库体积和开发体验

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | `.gitignore` 忽略 `dist/`，CI 构建后发布 | 仓库干净 | clone 后须 `pnpm build` 才能运行 |
| B | `dist/` 提交到 Git | clone 即用 | 体积大，diff 污染 |

**推荐**：✅ 选项 A — `.gitignore` 忽略 `dist/`，CI 中构建后发布

**确认理由**：
1. 构建产物不应入库，npm 生态标准实践
2. 开发时 `pnpm dev` 即可，不需要 dist/
3. npm publish 前 CI 自动执行 `pnpm build`

**状态**：⏳ 待确认

---

## 决策汇总

| # | 决策 | 推荐方案 | 状态 |
| --- | ------ | ---------- | ------ |
| 1 | CLI 技术栈确认 | TypeScript + commander.js + tsup | ✅ 已确认 |
| 2 | Node.js 版本与模块系统 | Node.js >= 20，纯 ESM（修正：18→20） | ✅ 已确认 |
| 3 | 包管理器 | pnpm（修正：原推 npm → pnpm） | ✅ 已确认 |
| 4 | 测试框架 | vitest | ✅ 已确认 |
| 5 | Mock 命令行为 | 友好提示 + 退出码 0 | ✅ 已确认 |
| 6 | Driver 接口组织方式 | `cli/src/drivers/` 扁平目录 | ✅ 已确认 |
| 7 | 命令注册模式 | 独立文件 + commands/index.ts 批量注册 | ✅ 已确认 |
| 8 | GitHub Actions 触发策略 | CI: push/PR → lint+test+build; CD: v* tag → npm publish | ✅ 已确认 |
| 9 | CI Node.js 版本矩阵 | 20.x、22.x、24.x（修正：同步决策2） | ✅ 已确认 |
| 10 | npm 发布范围与访问级别 | npm 公共 registry，@avfs/avfs-cli，public（包名@avfs/avfs-cli 全文档统一） | ✅ 已确认 |
| 11 | 构建产物规范 | ESM + CJS 双输出，bin 指向 ESM | ✅ 已确认 |
| 12 | 不支持的 Node 版本 | engines 声明 + 运行时友好提示 | ✅ 已确认 |
| 13 | 无效命令处理 | commander 默认行为 | ✅ 已确认 |
| 14 | 无参数运行行为 | commander 默认 help | ✅ 已确认 |
| 15 | --version 输出 | 仅版本号 | ✅ 已确认 |
| 16 | publish 失败处理 | 直接失败 | ✅ 已确认 |
| 17 | dist/ .gitignore | 忽略，CI 构建时生成 | ✅ 已确认 |

---

## 回答记录

> 以下由用户逐一回答后填写

### 决策点 1–11 回答（批量确认 + 修正）

**回答**：✅ 全部 11 个决策点按推荐方案确认。
- 决策点 2、9 修正：Node 最低版本 18→20，CI 矩阵 18/20/22→20/22/24
- 决策点 3 修正：npm → pnpm
- 决策点 10 修正：包名 `@avfs/avfs-cli`（全文档统一）
**日期**：2026-05-24

### 决策点 4–17 回答（逐条确认）

**回答**：✅ 决策点 4–17 按推荐方案确认。其中决策点 10 强调包名 `@avfs/avfs-cli` 需全文档统一。
**日期**：2026-05-24

- [项目总体计划](../../overall-plan.md) — 项目规划总览
- [CLI README](../../../../cli/README.md) — CLI 技术规划
- [架构设计](../../../../.asdm/contexts/layer-2/architecture.md) — 系统架构与 Driver 接口
- [项目结构](../../../../.asdm/contexts/layer-2/standard-project-structure.md) — 标准项目结构

---

**文档版本**：0.1
**创建日期**：2026-05-24
**最后更新**：2026-05-24（17/17 决策全部确认）
**维护者**：AI Agent (qahc-harness)
