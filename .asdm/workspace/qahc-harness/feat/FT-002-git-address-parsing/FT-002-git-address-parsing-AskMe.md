# FT-002 Git 地址解析 — 需求访谈追问

> 本文档记录对 FT-002 CLI 实现 git/github.com 地址解析能力特性的逐问题追问，用于澄清需求模糊点后制定最终需求规格。

**创建日期**：2026-05-25
**负责人**：Lei Xu
**状态**：已完成

---

## 背景摘要

AVFS 项目已完成 FT-001 CLI 基础框架搭建（help/version + 6 组 Mock 子命令 + CI/CD），但所有命令均为占位实现，无任何实际地址解析代码。FT-002 将首次实现真实功能：为 CLI 注入**全协议通用地址解析器** + git/github.com 原生 URL 识别与转换 + GitHub API Driver 实现，并激活全部 4 个业务命令（validate/stat/convert/fetch）。

### 核心价值

- **全协议地址解析**：file/http/https/smb/git 五种协议的 AVFS URI 统一解析为结构化对象
- **全协议双向转换**：原生路径/URL ↔ `avfs://` 格式无损映射（5 协议全覆盖）
- **GitHub API Driver**：通过 GitHub REST API 直接获取文件内容，零本地存储、零系统依赖
- **全链路 CLI 可用**：validate → stat → convert → fetch 四个命令全部从 Mock 变为真实实现

### 变更范围

| 变更模块 | 变更内容 |
| ---------- | ---------- |
| `cli/src/parser/` | 新增全协议地址解析模块：AVFS URI 拆解 + 各协议转换器（file/http/https/smb/git）+ Git 平台检测 |
| `cli/src/drivers/git.driver.ts` | 从 stub 替换为 GitHub API Driver（`GET /repos/{org}/{repo}/contents/{path}?ref={version}`） |
| `cli/src/commands/validate.command.ts` | 从 Mock 替换为全协议地址语法校验 |
| `cli/src/commands/stat.command.ts` | 从 Mock 替换为全协议地址解析 + 结构化 JSON 输出 |
| `cli/src/commands/convert.command.ts` | 从 Mock 替换为全 5 协议双向转换（`--to-avfs`/`--to-native`） |
| `cli/src/commands/fetch.command.ts` | 从 Mock 替换为 Git 协议文件获取（非 git 协议明确报错） |
| `cli/test/` | 新增 parser + driver + commands 单元测试与集成测试 |

### 初始需求

> 新特性 cli实现git/github.com地址解析能力

---

## 决策点

### 决策点 1：特性范围界定

**问题**：FT-002 应仅实现 git 协议的地址解析，还是实现全协议的通用地址解析器？

**背景**：
- 用户描述"cli实现git/github.com地址解析能力"，明确指向 git 协议
- 但通用 AVFS URI 解析（拆解 `avfs://proto/base@ver/path#anchor`）是 git 地址解析的**前置依赖**——没有通用解析器，git 特殊逻辑无处安放
- 从架构文档看，`avfs stat` 的输出对所有协议格式一致（protocol、resourceBase、version、filePath、anchor）
- 全协议解析的差异主要在于 `resourceBase` 格式和转换逻辑不同，核心 URI 拆解逻辑是统一的

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅实现 git 协议解析（含通用 URI 拆解作为内部基础设施） | 聚焦用户需求，交付快 | 其余协议（file/http/smb）仍需后续特性补全 |
| B | 实现全协议通用地址解析器 + git 原生 URL 转换作为插件 | 一次建成，后续只需填驱动 | 范围大，交付周期长 |

**用户选择**：✅ 选项 B — 实现全协议通用地址解析器 + git 原生 URL 转换作为插件

**确认理由**：
1. 一次建成全协议解析器，后续特性只需填充各协议 driver
2. convert 命令对全部 5 协议生效，功能闭环完整
3. 通用 URI 拆解是所有协议的共同基础，无重复工作

**状态**：✅ 已确认

---

### 决策点 2：Git 原生 URL 支持范围

**问题**：FT-002 应支持哪些格式的 Git 原生 URL 识别和转换？

**背景**：
- SKILL.md §Protocol-Specific Conversion Rules 定义了两种 git 原生输入：
  - **HTTPS clone URL**：`https://github.com/avfs-io/core.git` → `avfs://git/github.com/avfs-io/core/...`
  - **SSH URL**：`git@github.com:avfs-io/core.git` → `avfs://git/github.com/avfs-io/core/...`
- 此外，用户可能输入**裸仓库引用**（无协议前缀）：`github.com/avfs-io/core`
- 规范文档 conversion-rules.md §5.1 定义了完整的 Git URL 转换算法

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅 HTTPS clone URL（`https://github.com/...`） | 实现简单，覆盖 80% 场景 | 不支持 SSH 用户 |
| B | HTTPS + SSH（`git@github.com:...`）两种格式 | 覆盖主流开发场景 | SSH URL 解析稍复杂（`:` 分隔符替代 `/`） |
| C | HTTPS + SSH + 裸引用（`github.com/org/repo`）三种格式 | 最完整覆盖 | 裸引用判别依赖上下文（可能与 http 协议混淆） |

**推荐**：✅ 选项 B — HTTPS + SSH 两种格式，暂不支持裸引用

**确认理由**：
1. HTTPS 和 SSH 是 GitHub 官方提供的唯二 clone 方式
2. 裸引用 `github.com/org/repo` 无法区分是 git 仓库还是 HTTP 资源（`avfs://http/github.com/...`），需显式 `--protocol git` 参数或上下文推断，增加复杂度
3. FT-002 聚焦 git 协议，裸引用支持留到 `avfs convert` 实现时通过 `--to-avfs --protocol git` 处理

**状态**：✅ 已确认

---

### 决策点 3：Git 平台覆盖范围

**问题**：FT-002 是否仅支持 GitHub，还是同时支持 GitLab、Azure DevOps、Bitbucket、自托管？

**背景**：
- 用户明确提到"git/github.com"
- 规范文档定义了 5 种 git 平台的原生 URL 模式（conversion-rules.md §5.1）
- SKILL.md §Supported Git Platforms 列出了 GitHub/GitLab/Azure DevOps/Bitbucket/Self-hosted
- GitHub 是目前最广泛使用的平台

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅 GitHub | 聚焦用户需求，交付最快 | 后续扩展需重构平台检测逻辑 |
| B | GitHub + 可扩展平台注册机制（先实现 GitHub，架构预留其他平台接口） | 架构一步到位，后续添加平台零重构 | 初期多写一些抽象代码 |

**推荐**：✅ 选项 B — 实现 GitHub 平台解析 + 架构层预留 `GitPlatform` 接口扩展点

**确认理由**：
1. 用户需求聚焦 GitHub，但规范明确规定了多平台
2. 平台检测逻辑差异主要在 `resourceBase` 提取规则（GitHub: `owner/repo`，Azure DevOps: `org/project/_git/repo`）
3. 用策略模式（`GitPlatform` 接口 + `GitHubPlatform` 实现）可以保持架构干净，后续添加 GitLab 只需新增实现类
4. 只需约 30 行额外抽象代码，换来免重构的扩展性

**状态**：✅ 已确认

---

### 决策点 4：CLI 命令激活范围 + Git Driver 实现

**问题**：FT-002 应激活哪些 CLI 子命令的实际实现？Git Driver 是否实现？

**背景**：
- FT-001 中 6 组子命令均为 Mock 占位，Git Driver 为 stub（全部 throw "Not implemented"）
- FT-002 实现地址解析后，**validate** 和 **stat** 是最直接受益的命令
- **convert** 命令也需要地址解析 + 转换逻辑
- **fetch** 命令依赖 git driver 的实际实现（clone/pull）

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 激活 validate + stat（解析和校验为核心） | 聚焦"解析"，交付快 | convert 仍是 Mock |
| B | 激活 validate + stat + convert（解析+校验+双向转换） | 功能闭环完整 | convert 的 git 平台原生 URL 输出逻辑较复杂 |
| C | 全部激活（validate/stat/convert/fetch）+ Git Driver 实际实现，Driver 保持在 cli 内部不独立 | 全链路 git 工作流可运行，一次到位 | 范围最大，需实现 Git Driver 的真实 clone/read 逻辑 |

**用户选择**：✅ 选项 C — 全部激活并实现 Git Driver，放置在 cli 内部不独立

**状态**：✅ 已确认（修正自推荐 A → 用户选择 C）

---

### 决策点 5：代码模块组织方式

**问题**：地址解析器代码放在 `cli/` 内还是独立 `core/` 目录？

**背景**：
- FT-001 决策点 6 已将 5 类 Driver 暂存于 `cli/src/drivers/`（后续拆分到 `driver/`）
- 架构文档将"地址解析器"定位在 `core/` 核心引擎
- FT-001 的设计原则是"先集中在 cli 快速推进，后续拆分"
- 当前 `core/` 目录仅含 README，无任何代码

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 放在 `cli/src/parser/` 内（延续 FT-001 策略） | 与 Driver 策略一致，快速迭代 | 后续需迁移 |
| B | 直接放在 `core/src/parser/`，创建独立 npm 包 `@avfs/core` | 符合架构规划，一步到位 | 需要创建新包、配置构建、处理 cli↔core 依赖 |

**推荐**：✅ 选项 A — 放在 `cli/src/parser/`，延续 FT-001 "先集中后拆分"策略

**确认理由**：
1. 与 FT-001 的决策逻辑一致——Driver 已暂存 cli 内，Parser 同样策略保持简单
2. 避免引入 monorepo 包依赖管理的复杂性（workspace 配置、跨包引用）
3. Parser 模块独立目录（`cli/src/parser/`），拆分时直接迁移到 `core/` 无重构成本
4. FT-002 的核心目标是功能可运行，而非架构完美

**状态**：✅ 已确认

---

### 决策点 6：ParsedAddress 数据结构设计

**问题**：解析后的 AVFS 地址应使用什么数据结构？

**背景**：
- 地址语法规范 §2 定义了 5 个字段：proto、resourceBase、version、filePath、anchor
- 架构设计 §1 将解析器输出描述为"结构化 ParsedAddress 对象"
- 这个数据结构将被 validate、stat、convert、fetch 共用，设计应足够通用

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 简单 TypeScript interface：`{ protocol, resourceBase, version?, filePath, anchor? }` | 轻量，与 spec 1:1 映射 | 缺少元信息（协议类型、是否有效等） |
| B | 带元信息的类型：含 `protocol`、`resourceBase`、`version?`、`filePath`、`anchor?`、`isValid`、`errors[]`、`rawInput` | 信息完整，便于调试和错误提示 | 字段较多 |
| C | 分层类型：`AvfsUri`（原始字段）+ `ParseResult`（含校验结果）+ `GitContext`（git 专属扩展） | 类型安全，关注点分离 | 类型数量多，稍显复杂 |

**推荐**：✅ 选项 B — 带元信息的单一 ParsedAddress 类型，既可用于 valid 也可用于 invalid 地址

**确认理由**：
1. `isValid` + `errors[]` 避免对 invalid 地址返回 null/throw，让 validate 命令的"校验但不崩溃"语义清晰
2. `rawInput` 保留原始输入，便于 stat 输出完整信息
3. 单类型比分层类型简单，FT-002 阶段不需要过度类型化
4. 后续可通过 `extends` 添加 Git 专属字段，向前兼容

**状态**：✅ 已确认

---

### 决策点 7：stat 命令输出格式

**问题**：`avfs stat <address>` 命令应以什么格式输出解析后的地址信息？

**背景**：
- SKILL.md Workflow 1 描述 stat 输出为"parsed metadata"，示例展示字段列表
- stat 可能被 AI Agent 解析（需要机器可读）或被开发者查看（需要人类可读）
- 不同输出格式适合不同消费者

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 人类友好的表格/列表格式 | 开发者查看直观 | AI Agent 解析困难 |
| B | JSON 格式（默认） | 机器可读，AI Agent 友好 | 开发者预览不直观 |
| C | JSON 默认 + `--format table` 选项 | 兼顾双方需求 | 初期实现稍多 |

**推荐**：✅ 选项 B — JSON 默认输出，简洁且机器友好

**确认理由**：
1. AVFS 的核心消费者是 AI Agent（SKILL 架构定位），JSON 是最佳机器格式
2. 开发者可通过 `| jq` 美化或后续版本加 `--pretty` 选项
3. FT-002 聚焦核心能力，`--format` 选项属于锦上添花
4. 与主流 CLI 工具（docker、kubectl `-o json`）实践一致

**状态**：✅ 已确认

---

### 决策点 8：Git Driver 实现策略（新增）

**问题**：Git Driver 应如何实现文件获取？使用何种 clone 策略和缓存机制？

**背景**：
- 决策点 4 已确认全部命令激活 + Git Driver 实际实现
- Git Driver 需要在 `connect()` 时获取仓库内容，`read()` 时返回文件流
- 三种典型实现策略：
  1. **shallow clone**：`git clone --depth 1 --branch <version> <url>` → 读取文件
  2. **GitHub API**：通过 REST API `GET /repos/{org}/{repo}/contents/{path}?ref={version}` 直接获取文件内容（无需本地 clone）
  3. **git archive**：`git archive --remote=<url> <version> <path>` → 流式传输
- GitHub API 方式无需本地磁盘、速度最快，但依赖网络且仅支持 GitHub
- shallow clone 通用性好，支持所有 git 平台，但有磁盘开销

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | GitHub API 方式（`GET /repos/.../contents/...`） | 无需本地存储，速度快 | 仅 GitHub 有效，其他平台需要 fallback；有 API rate limit（未认证 60次/小时） |
| B | `git clone --depth 1` 浅克隆到临时目录 | 通用性好，全平台支持 | 有磁盘 I/O 开销，需管理临时目录生命周期 |
| C | A + B 组合：优先 API（GitHub 平台），fallback 浅克隆（其他平台 + GitHub 大文件） | 两全其美 | 实现复杂度最高 |

**推荐**：~~选项 B~~ → **用户选择 A**：GitHub API（`GET /repos/{org}/{repo}/contents/{path}?ref={version}`）

**用户意图**：后续针对不同厂商适配不同的 API（GitLab API、Azure DevOps API 等），通过策略模式逐平台扩展。

**确认理由**：
1. 无需本地存储和 `git clone`，零磁盘开销
2. API 直取文件内容，速度最快（单次 HTTP 请求）
3. 不需要系统 `git` 依赖（决策点 11、12 随之废弃）
4. 后续通过 `GitPlatform` 接口（决策点 3）为 GitLab 等添加对应的 API 实现

**状态**：✅ 已确认

---

### 决策点 9：fetch 命令行为（新增）

**问题**：`avfs fetch <address>` 应将文件内容输出到哪里？

**背景**：
- SKILL.md Workflow 3 展示了两种 fetch 用法：
  - `avfs fetch <address> -o <output-path>` → 写入文件
  - `avfs fetch <address>` → 输出到 stdout（管道友好）
- FT-002 Git Driver 通过 GitHub API 获取文件内容，输出为 `ReadableStream<Uint8Array>`

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅支持 `-o` 写入文件 | 简单，避免二进制流输出到终端 | 不支持管道场景 |
| B | 默认 stdout + `-o` 可选 | 管道友好（`| jq`/`| yq`），符合 Unix 哲学 | 二进制内容输出到终端可能乱码 |
| C | 默认 `-o` 必填，`--stdout` 显式管道 | 安全性好（避免意外输出到终端） | 多一个 flag，不够简洁 |

**推荐**：✅ 选项 B — 默认 stdout，`-o` 可选写文件

**确认理由**：
1. 与 SKILL.md 定义的 CLI 接口完全一致
2. Unix 哲学：stdout 默认管道友好，`-o` 写文件
3. 二进制输出到终端的问题由用户自行负责（与 `curl`/`wget` 行为一致）
4. AI Agent 场景下通常通过管道消费内容（`avfs fetch ... | jq`）

**状态**：✅ 已确认

---

### 决策点 10：convert 命令行为（新增）

**问题**：`avfs convert` 对于 git 协议的双向转换应产生什么输出？

**背景**：
- SKILL.md Workflow 2 定义了 `--to-avfs`（原生→AVFS）和 `--to-native`（AVFS→原生）两种方向
- 对于 git 协议：
  - `--to-avfs`：`https://github.com/org/repo.git` → `avfs://git/github.com/org/repo/...`
  - `--to-native`：`avfs://git/github.com/org/repo@v1.0.0/path/file.ts` → 需要输出什么格式？

**`--to-native` 目标格式选项**：

| 选项 | 描述 | 示例输出 |
| ------ | ------ | --------- |
| A | 完整 HTTPS clone URL + path | `https://github.com/org/repo.git` (version: v1.0.0, path: path/file.ts) |
| B | 简化的平台引用 + 元信息 | `github.com/org/repo@v1.0.0:path/file.ts` |
| C | 多字段 JSON 输出 | `{"cloneUrl":"https://github.com/org/repo.git","version":"v1.0.0","filePath":"path/file.ts"}` |

**推荐**：✅ 选项 C — JSON 格式输出，完整保留所有字段

**确认理由**：
1. convert 的 `--to-native` 对于 git 协议没有唯一的"原生格式"（clone URL 不含 path，本地路径取决于 clone 位置）
2. JSON 可以无损保留 version + filePath + resourceBase 全部信息，避免歧义
3. 与 stat 的 JSON 输出保持一致
4. AI Agent 可以直接消费 JSON 中的 cloneUrl 字段执行 `git clone`

**状态**：✅ 已确认

---

### 决策点 11：临时目录管理策略（新增）

**问题**：Git Driver 浅克隆产生的临时仓库如何管理生命周期？

**背景**：
- 决策点 8 确定使用 `git clone --depth 1` 到临时目录
- Git Driver 的 `close()` 方法应清理资源
- 临时目录的存放位置和清理策略影响磁盘使用和并发安全

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 每次 connect 创建新临时目录，close 时立即删除 | 磁盘干净，无残留 | 同一仓库多次 fetch 重复 clone |
| B | 基于仓库 URL + version 的缓存目录（如 `~/.avfs/cache/github.com-org-repo@v1.0.0/`），close 不删除 | 避免重复 clone，速度快 | 需处理缓存过期和磁盘空间管理 |
| C | 临时目录 + LRU 缓存：最近 N 个仓库保留，超出自动清理 | 兼顾性能与空间 | 实现复杂 |

**推荐**：✅ 选项 A — 每次 clone 临时目录，close 时清理

**确认理由**：
1. 简单可靠，无需管理缓存过期/磁盘空间/TTL
2. `--depth 1` 浅克隆速度已足够快（小型仓库 < 2 秒）
3. 无并发安全问题（每次独立临时目录）
4. FT-002 聚焦核心功能，缓存优化留待后续特性（如 `avfs cache` 子命令）
5. 与 `mktemp -d` / `os.tmpdir()` 的 Unix 实践一致

**状态**：❌ 废弃（决策点 8 选用 GitHub API，不再需要临时目录管理）

---

### 决策点 12：Git 命令依赖与错误处理（新增）

**问题**：Git Driver 依赖系统 `git` 命令吗？如果系统无 `git` 如何处理？

**状态**：❌ 废弃（决策点 8 选用 GitHub API，直接 HTTP 请求，零系统依赖）

---

### 决策点 13：convert 协议范围（新增于决策点 1 改为 B 后）

**问题**：改为全协议通用解析器后，convert 命令应覆盖哪些协议的转换？

**背景**：
- 决策点 1 已确认全协议通用解析器（选项 B）
- convert 命令规格涵盖 5 种协议：file、http、https、smb、git
- file/http/https 的转换算法几乎无歧义（直接路径/URL 映射）
- smb 的 UNC ↔ AVFS 转换稍复杂（路径分隔符替换）

**选项**：

| 选项 | 描述 |
|------|------|
| A | 全 5 协议双向转换（一次性建成） |
| B | 仅 file + http/https + git（跳过 smb） |
| C | file + git 先行，http/https/smb 留待后续 |

**推荐**：✅ 选项 A — 全 5 协议双向转换

**确认理由**：
1. file/http/https 的转换算法几乎无歧义（直接路径/URL 映射），增加成本有限（约 80 行额外代码）
2. smb 的 UNC → AVFS 也只是路径替换，复杂度可控
3. convert 命令从此完整可用，无需后续补全

**状态**：✅ 已确认

---

### 决策点 14：fetch 非 git 协议行为（新增于决策点 1 改为 B 后）

**问题**：fetch 命令对非 git 协议地址（file/http/https/smb）应如何响应？

**背景**：
- 决策点 4 确认全部命令激活，但仅 Git Driver 被实现（决策点 8）
- file/http/https/smb 的 Driver 仍为 stub（throw "Not implemented"）
- fetch 调用这些 stub 会抛出异常，需优雅处理

**选项**：

| 选项 | 描述 |
|------|------|
| A | 返回明确错误 "avfs fetch for <proto> is not yet implemented"（退出码 1） |
| B | 实现 file 协议的简易 fetch（`fs.readFile`），http/https/smb 仍报错 |

**推荐**：✅ 选项 A — 明确报错

**确认理由**：
1. 聚焦交付，避免范围蔓延
2. file 协议 fetch 虽然简单但需要处理 mimeType、stat 等细节
3. 明确错误信息引导用户，后续特性再实现

**状态**：✅ 已确认

---

## 决策汇总

| # | 决策 | 方案 | 状态 |
| --- | ------ | ---------- | ------ |
| 1 | 特性范围界定 | **B — 全协议通用解析器** | ✅ 已确认 |
| 2 | Git 原生 URL 支持范围 | B — HTTPS + SSH 格式 | ✅ 已确认 |
| 3 | Git 平台覆盖范围 | B — GitHub 实现 + 可扩展接口 | ✅ 已确认 |
| 4 | CLI 命令激活 + Git Driver | **C — 全部激活 + Driver 在 cli 内** | ✅ 已确认 |
| 5 | 代码模块组织 | A — `cli/src/parser/` | ✅ 已确认 |
| 6 | ParsedAddress 数据结构 | B — 带元信息 | ✅ 已确认 |
| 7 | stat 输出格式 | B — JSON 默认 | ✅ 已确认 |
| 8 | Git Driver 实现策略 | **A — GitHub API**（后续适配多厂商） | ✅ 已确认 |
| 9 | fetch 命令行为 | B — stdout + `-o` 可选 | ✅ 已确认 |
| 10 | convert 命令行为 | C — `--to-native` JSON | ✅ 已确认 |
| 11 | 临时目录管理 | ~~废弃~~（API 模式不需要） | ❌ 废弃 |
| 12 | Git 命令依赖 | ~~废弃~~（API 模式不需要） | ❌ 废弃 |
| 13 | convert 协议范围 | A — 全 5 协议 | ✅ 已确认 |
| 14 | fetch 非 git 行为 | A — 明确报错 | ✅ 已确认 |

---

## 回答记录

> 以下由用户逐一回答后填写

### 决策点 1–3 回答

**回答**：✅ 决策点 1、2、3 按 AI 推荐方案确认。
**日期**：2026-05-25

### 决策点 4 回答

**回答**：✅ 选项 C — 全部命令激活（validate/stat/convert/fetch）+ Git Driver 实际实现，Driver 保持在 cli 内部不独立。
**日期**：2026-05-25

### 决策点 1 修正

**回答**：✅ 决策点 1 从 A 修正为 B — 全协议通用地址解析器。
**日期**：2026-05-25

### 决策点 5–7 回答

**回答**：✅ 决策点 5、6、7 按 AI 推荐方案确认。
**日期**：2026-05-25

### 决策点 8 回答

**回答**：✅ 选项 A — GitHub API（`GET /repos/{org}/{repo}/contents/{path}?ref={version}`），后续针对不同厂商适配不同 API。
**日期**：2026-05-25

### 决策点 9–14 回答

**回答**：✅ 决策点 9、10、13、14 按 AI 推荐方案全部确认。
**日期**：2026-05-25

---

## 关联文档

- [项目总体计划](../../overall-plan.md) — 项目规划总览
- [FT-001 AskMe](../FT-001-cli-foundation/FT-001-cli-foundation-AskMe.md) — 前序特性决策记录
- [地址语法规范](../../../../docs/contents/zh-cn/spec/address-syntax.md) — AVFS URI 语法 ABNF 定义
- [转换规则](../../../../docs/contents/zh-cn/spec/conversion-rules.md) — Git URL 转换规范

---

**文档版本**：1.0
**创建日期**：2026-05-25
**最后更新**：2026-05-25（14/14 决策全部确认，访谈完成）
**维护者**：AI Agent (qahc-harness)
