# FT-003 Driver 接口标准化 + File 驱动实现 — 需求访谈追问

> 本文档记录对 FT-003 Driver 接口标准化与核心驱动实现特性的逐问题追问，用于澄清需求模糊点后制定最终需求规格。

**创建日期**：2026-05-27
**负责人**：Lei Xu
**状态**：已完成

---

## 背景摘要

### 来源：FT-002 docs-vs-code 完整差异分析

FT-002（Git 地址解析）实现完成后，对 `cli/src/` 全部代码实现 与 `docs/contents/` 及 `skills/avfs-skill/SKILL.md` 进行了逐项对比分析。共发现 **9 类差异**，按严重程度分级如下：

| 严重度 | 差异项 | 代码行为 | 文档描述 | 处理结果 |
|:---:|--------|----------|----------|:---:|
| 🔴 | 版本语法 | `?ref=main` 查询参数 | `@main` 内联语法 | ✅ 文档已更新（9 文件） |
| 🟠 | SMB resourceBase | `{host}` 仅主机 | `{host}/{share}` 含共享名 | ✅ 文档已更新（6 文件） |
| 🟠 | Driver 接口 | 简化 4 方法（string 参数、void 返回、普通 Error） | 完整 AVFSDriver（元数据/生命周期/Connection/9 种错误类型/ParsedAddress 参数） | ➡️ **转入 FT-003** |
| 🟡 | `avfs stat` 行为 | 仅输出 `ParsedAddress` JSON | 应输出文件元数据（size/MIME/timestamps） | ➡️ **转入 FT-003** |
| 🟡 | CLI 命令/选项 | `convert` 自动检测方向；无 `-v`/`-q`/`--batch`/`--from-format` | 需显式指定方向；列出未实现选项 | ✅ 文档已更新（3 文件） |
| 🟡 | ParsedAddress 类型 | `rawInput`/`filePath: string\|null`/`isValid`/`errors` | `raw`/`filePath: string`/`query`/无校验元信息 | ✅ 文档已更新（2 文件） |
| 🟡 | convert-to-native git 输出 | JSON `{cloneUrl, version, filePath}` | Clone URL + 文本描述 | ✅ 文档已更新（2 文件） |
| 🟢 | Node.js 版本 | `>= 20`（package.json） | `>= 18`（SKILL.md） | ✅ 文档已更新 |
| 🟢 | docs/README 文件计数 | 实际含 authentication.md | 标注 "(6 files)" 不含 | ✅ 文档已更新 |

### 转入 FT-003 的两个核心缺口

经过前期文档更新，以下两项差异涉及**代码变更**而非文档变更，需要新特性来弥合：

#### 缺口一：Driver 接口标准化

当前代码 `cli/src/drivers/driver.interface.ts` 与文档 `driver-interface.md` 的详细对比：

| 维度 | 当前代码 | 当前文档 | 差距 |
|------|----------|----------|:--:|
| 元数据字段 | `protocol: string` | `protocol` + `version` + `displayName` + `description` | 3 字段缺失 |
| 生命周期 | 无 | `initialize(config)` + `destroy()` | 缺失 |
| connect 签名 | `connect(resourceBase: string, options?) → void` | `connect(address: ParsedAddress) → Connection` | 参数/返回类型均不同 |
| stat 签名 | `stat(filePath: string) → FileMetadata` | `stat(address: ParsedAddress) → ResourceMetadata` | 参数类型不同 |
| read 签名 | `read(filePath: string) → ReadableStream` | `read(address, options?) → ReadableStream` | 参数类型不同 |
| 错误类型 | 普通 `Error`（GitDriver 按字符串分类） | 9 种 `AVFSError` 子类（含 `code`） | 缺失 |
| 元数据模型 | `FileMetadata`：4 字段（size/mimeType/modifiedAt/protocol） | `ResourceMetadata`：9+ 字段（name/path/contentType/etag/checksum...） | 差距大 |
| 可选方法 | 无 | `list()`/`exists()`/`write()`/`delete()` | 缺失 |
| 非 git 驱动 | 4 个全部 stub（throw "Not implemented"） | 按协议分别实现 | 未实现 |

> **当前唯一生产级驱动**：`GitDriver`（FT-002 实现），通过 GitHub REST API 实现 connect/read/stat/close。其余 4 驱动均为 FT-001 占位 stub。

#### 缺口二：avfs stat 仅做地址解析，未连接驱动

| 维度 | 当前代码 (`stat.command.ts`) | 期望行为 |
|------|----------|----------|
| 输入 | `avfs stat <address>` | 不变 |
| 处理 | `parseAvfsUri()` → 输出 `ParsedAddress` JSON | 先解析地址 → 调用驱动 `stat()` → 输出 `FileMetadata` |
| 输出 | `{protocol, resourceBase, version, filePath, anchor, rawInput, isValid}` | `{size, mimeType, modifiedAt, protocol, ...}` |
| GitDriver 的 stat | 已实现（通过 GitHub API Contents JSON 返回 size/mimeType） | 已实现但 CLI 未调用 |

### 现有状态

FT-002 完成后，CLI 已具备完整的地址解析能力，5 协议解析器、Git 协议双向转换、GitHub API Driver 均已实现并打通了 `validate`/`stat`/`convert`/`fetch` 四个命令的端到端链路。

### 核心价值

- **标准化驱动契约**：将 Driver 接口从简化的 4 方法升级为与文档一致的合同级接口，为后续 http/https/smb 驱动实现提供统一基线
- **打通首个非 git 驱动**：实现 file 协议驱动（本地文件系统），验证驱动接口的正确性和完备性
- **avfs stat 连接真实驱动**：让 `avfs stat` 能够获取文件元数据（而非仅解析地址）

### 变更范围

| 变更模块 | 变更内容 |
| ---------- | ---------- |
| `cli/src/drivers/driver.interface.ts` | 补充元数据字段、标准化错误类型；决定是否引入 Connection、生命周期方法 |
| `cli/src/drivers/file.driver.ts` | 从 stub 替换为本地文件系统实现，核心 + 可选（initialize/destroy/connect/stat/read/list/exists） |
| `cli/src/drivers/git.driver.ts` | 适配新 AVFSDriver 接口（ParsedAddress 参数、Connection 返回、ResourceMetadata、9 种错误类型） |
| `cli/src/commands/stat.command.ts` | 连接驱动 `stat()` 获取文件元数据（而非仅地址解析） |
| `cli/src/commands/fetch.command.ts` | 支持 file 协议 fetch（`fs.readFile` → stdout/`-o` 输出） |
| `cli/test/` | 新增 file.driver.test.ts + 更新已有测试 |
| `docs/contents/*/spec/driver-interface.md` | 以代码实现为准统一更新（en-us + zh-cn） |

### 初始需求

> 基于 FT-002 完成后的 docs-vs-code 差异分析，将 Driver 接口标准化并对齐文档与代码实现。同时实现 file 协议驱动作为首个非 git 驱动的参考实现。

---

## 决策点

### 决策点 1：Driver 接口 —— 渐进演进 vs 一步到位

**问题**：Driver 接口应从当前的简化版逐步演进，还是直接实现文档中定义的全部能力？

**背景**：
- **当前代码**（`driver.interface.ts`）：`Driver` 接口仅 `protocol` 属性 + `connect(resourceBase, options?)` / `read(filePath)` / `stat(filePath)` / `close()` 四个方法，参数使用原始 string，`connect` 返回 `void`，错误为普通 `Error`
- **当前文档**（`driver-interface.md`）：`AVFSDriver` 接口包含 `version`/`displayName`/`description` 元数据字段，`initialize(config)`/`destroy()` 生命周期方法，`connect` 返回 `Connection` 对象，方法接收 `ParsedAddress`，9 种标准化错误类型，可选方法 `list`/`exists`/`write`/`delete`
- FT-002 决策延续了"先集中后拆分"策略，所有代码集中在 CLI 内，遵循渐进式原则
- 4 个非 git 驱动目前全是 stub，FileDriver 将是首个被实现的

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 最小变更：保持当前 4 方法接口不变，仅实现 file driver 的 read/stat/close | 改动极小，快速交付 | `stat` 返回 `FileMetadata` 仅有 4 字段（size/mimeType/modifiedAt/protocol），信息不完整；无法支撑未来扩展 |
| B | 渐进演进：补充元数据字段（version/displayName/description）和标准化错误类型（NotFoundError 等），方法签名保持当前简单风格（string 参数而非 ParsedAddress） | 在代码与文档间取得平衡，关键能力补齐；不引入 Connection 避免过度设计 | 仍缺少 Connection/生命周期，后续需再次迁移 |
| C | 一步到位：实现文档中完整的 `AVFSDriver` 接口（元数据 + 生命周期 + Connection + ParsedAddress 参数 + 全部错误类型） | 接口一步到位，后续无需再改 | 范围极大，需重写 GitDriver，当前无 Connection 的实际用例（GitHub API 无状态），过度设计风险高 |

**推荐**：✅ 选项 B — 渐进演进，补齐元数据字段和标准化错误类型，保持方法签名简单

**确认理由**：
1. FT-002 的 GitDriver 已证明"connect → read/stat → close" 的简单模式对 API 驱动场景完全够用，Connection 对象在当前阶段无实际收益
2. `version`/`displayName`/`description` 元数据字段为未来插件管理（`avfs plugin list` 展示信息）提供基础，是一次性低成本的补充
3. 标准化错误类型（如 `NotFoundError`、`PermissionError`）对 AI Agent 错误处理至关重要——Agent 需要根据错误类型（而非错误消息字符串匹配）做出不同响应
4. 方法签名保持 `string` 参数避免引入 ParsedAddress 到驱动层的循环依赖问题

**状态**：✅ **Confirmed: Option C** -- User chose full implementation of documented AVFSDriver interface

---

### 决策点 2：File Driver 可选方法实现范围（DP1 Option C 后重新评估）

**问题**：在完整 `AVFSDriver` 接口（DP1 Option C 确认）下，File Driver 应额外实现哪些可选方法？

**背景**：
- DP1 确认为 Option C（完整 AVFSDriver 接口），包含：元数据字段（version/displayName/description）、生命周期（initialize/destroy）、核心操作（connect→Connection、stat→ResourceMetadata、read with ParsedAddress+ReadOptions）
- 可选方法（文档定义）：`list?()`、`exists?()`、`write?()`、`delete?()`
- File Driver 基于 POSIX `fs` 模块，`exists`（`fs.existsSync`）和 `list`（`fs.readdir`→`Entry[]`）实现成本极低（各 3-5 行）
- `list?()` 已在协议规范 `driver-interface.md` 中定义为核心操作区的可选方法（`list?(address: ParsedAddress, options?: ListOptions): Promise<Entry[]>`），返回 name/path/type/size/lastModified
- `write`/`delete` 在协议中存在但当前 CLI 无命令入口（`avfs write`/`avfs delete` 不存在）

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 核心 + `exists` + `list`：实现 `exists`（`fs.existsSync`）和 `list`（`fs.readdir` → `Entry[]`） | exists 成本为 1 行代码；list 打通目录遍历，`avfs stat` 对目录返回目录列表 | 不包含 write/delete |
| B | 核心 + `exists` + `list` + `write` + `delete`：完整 CRUD | 功能最完整，与文档可选方法完全对齐；file 驱动作为参考实现可为后续驱动提供完整模板 | write/delete 引入安全风险（需结合 DP5 沙箱策略）；当前 CLI 无 write/delete 命令入口 |
| C | 仅核心 5 方法（initialize/destroy/connect/stat/read）：不实现任何可选方法 | 最小交付范围，零新增复杂度 | 浪费了 POSIX 天然的 `exists`/`list` 能力，对目录无法提供信息 |

**推荐**：✅ 选项 A — 核心 + `exists` + `list`

**确认理由**（用户选择）：
1. `exists`（`fs.existsSync`）和 `list`（`fs.readdir` → `Entry[]`）是 POSIX 文件系统天然能力，实现成本极低
2. `list?()` 已在协议规范 `driver-interface.md` 明确定义，实现它确保 file 驱动与协议完全一致
3. `write`/`delete` 当前 CLI 无命令入口（`avfs write`/`avfs delete` 不存在），属于无消费端的纯接口能力，反而增加安全攻击面；后续特性可按需追加

**状态**：✅ 已确认（Option A — 核心 + exists + list）

---

### 决策点 3：`avfs stat` 行为（DP1 / DP2 确认后重新评估）

**问题**：在 DP1 Option C（完整 AVFSDriver，stat 签名为 `stat(address: ParsedAddress) → Promise<ResourceMetadata>`）和 DP2（File Driver 完整 CRUD）的背景下，`avfs stat` 命令应如何获取和输出文件元数据？

**背景**：
- **当前代码**：`avfs stat` 调用 `parseAvfsUri()` → 输出 `ParsedAddress` JSON（仅协议/地址字段，无文件元数据）
- DP1 Option C：`stat` 接收 `ParsedAddress` 返回 `ResourceMetadata`（9+ 字段：name/path/size/mimeType/contentType/lastModified/etag/checksum/permissions）
- DP2 Option A：File Driver 核心 + exists + list，`stat()` 已实现，可获取完整 POSIX 文件元数据
- GitDriver（FT-002）已实现 `stat()` 返回 `FileMetadata` 但 CLI 尚未调用
- http/https/smb 驱动仍是 stub，`stat()` 未实现
- `ResourceMetadata` 中的 `path` 和 `name` 字段与 `ParsedAddress.filePath` 自然对应

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
|:----:|------|------|------|
| A | 直接调用驱动：`avfs stat` 解析地址 → 调用驱动 `stat(ParsedAddress)` → 输出 `ResourceMetadata` JSON；驱动未实现 `stat()` 时抛出 `NotImplementedError` | 输出统一为 `ResourceMetadata`，语义清晰；驱动实现后自动生效；DP1 中 Not ImplementedError 是 9 种标准错误之一 | 未实现 stat 的协议（http/https/smb）调用 stat 将报错 |
| B | 渐进回退：优先驱动 `stat()`，驱动未实现时回退到 `ParsedAddress` 输出（加 `_source` 标识） | 渐进增强，不破坏已有可用性 | 输出格式不统一（`ResourceMetadata` vs `ParsedAddress`），Agent 需处理两种格式 |
| C | 混合输出：同时输出 `ParsedAddress` + `ResourceMetadata`（驱动可用时合并为一个对象） | 信息最完整 | 输出冗长；ParsedAddress 字段与 ResourceMetadata 的 path/name 字段冗余 |

**推荐**：✅ 选项 A — 直接调用驱动，输出统一的 ResourceMetadata

**确认理由**（用户确认）：
1. 统一输出格式减少 Agent 解析歧义，符合 DP1 "一步到位"的设计哲学
2. DP1 已定义 `NotImplementedError`（`code = 'NOT_IMPLEMENTED'`），驱动未实现时抛出标准化错误而非模糊回退
3. file（DP2 CRUD）和 git（FT-002）两个最常用协议的 stat 立即可用
4. http/https/smb 虽暂不可用，但 `NotImplementedError` 给出了明确的错误类别，Agent 可据此决策下一步，而非收到格式不一致的输出

**状态**：✅ 已确认（Option A — 直接调用驱动，统一 ResourceMetadata 输出）

---

### 决策点 4：错误类型标准化

**问题**：是否引入标准化错误类型，还是继续使用普通 `Error`？

**背景**：
- **当前代码**：GitDriver 使用普通 `Error("File not found: {path}")` 抛出错误，AI Agent 需通过错误消息字符串匹配来判定错误类别
- **当前文档**：定义了 9 种 `AVFSError` 子类，每种有独立 `code`（如 `NOT_FOUND`、`AUTH_FAILED`）
- AI Agent 对错误分类的需求明确：404（文件不存在）、403（限流）、超时（网络）需要不同处理策略
- GitDriver 已实现了 3 种错误分类（404/403/网络超时），但通过字符串差异区分，不够规范化
- File driver 需要 `ENOENT`（文件不存在）、`EACCES`（权限不足）、`EISDIR`（目录）等错误处理
- DP3 中对于未实现驱动需要抛出 `NotImplementedError`，该类型不在 DP4-B 的 4 种中

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 保持普通 Error | 零新增代码，GitDriver 当前模式已验证可行 | AI Agent 必须做脆弱的字符串匹配；未来驱动增多后难以统一 |
| B | 精简错误类型体系（4+1 种）：`NotFoundError`、`PermissionError`、`TimeoutError`、`ConnectionError` + 追加 `NotImplementedError` | 覆盖当前已知错误场景；GitDriver 和 FileDriver 直接受益；DP3 需求满足 | 与文档中 9 种类型不一致，但实际使用场景已覆盖 |
| C | 引入完整 9 种错误类型 | 与文档完全一致，一步到位 | 部分类型（WriteError/DeleteError/DriverInitError）当前无使用场景 |

**推荐**：✅ 选项 B — 4+1 种核心错误类型

**确认理由**：
1. 4 种类型 + NotImplementedError 覆盖了当前 GitDriver + FileDriver + DP3 的所有错误场景
2. 为 AI Agent 提供字符串独立的错误分类能力，大幅提升可靠性
3. 剩余类型可在未来实际遇到时增量追加，不增加当前交付成本
4. `AVFSError` 作为基类为后续扩展预留 `code` 字段

**状态**：✅ 已确认（Option B — 4+1 种：NotFound/Permission/Timeout/Connection/NotImplemented）

---

### 决策点 5：File Driver 的安全边界

**问题**：File Driver 的路径访问应限制在什么范围内？是否需要沙箱机制？

**背景**：
- File Driver 通过 `avfs://file/...` 地址访问本地文件，`resourceBase` 是磁盘路径段
- DP2 选择核心 + exists + list（不含 write/delete），写风险已排除，但 read/stat/list 仍存在 `../` 路径遍历的读风险
- `../` 向上级目录遍历可访问非预期文件

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
|:----:|------|------|------|
| A | 不限制：遵循当前解析规则，允许 `../` 遍历，不做沙箱 | 实现极简，与解析器行为完全一致 | 安全性完全依赖用户输入质量；对 AI Agent 自动执行的场景有路径遍历风险 |
| B | 路径规范化：解析 `../` 和 `./` 为规范路径后，确保最终路径在 `resourceBase` 指定的根目录内 | 安全且符合 Unix 文件系统语义 | 需要定义 resolve 逻辑；avfs URI 拆分模式可能导致根目录边界定义模糊 |
| C | 配置化沙箱：支持通过配置指定 `resourceBase` 白名单 | 完整的安全模型，企业级 | 引入配置系统，范围大；当前 CLI 不支持配置文件解析 |

**推荐**：✅ 选项 A — 不限制，允许 ../ 遍历，不做沙箱

**确认理由**（用户选择）：
1. 实现极简，与当前解析器行为完全一致
2. AI Agent 场景中，file 协议的 resourceBase 由 Agent 根据用户配置构造，非随机用户输入，路径遍历风险可控
3. GitDriver 的不限制策略（任何 GitHub URL 都可访问）已验证可行
4. 如需安全性增强，可在后续特性中增补

**状态**：✅ 已确认（Option A — 不限制，不做沙箱）

---

### 决策点 6：`avfs fetch` 扩展 —— file 协议支持

**问题**：File Driver 实现后，`avfs fetch` 应支持哪些协议？

**背景**：
- FT-002 中 `avfs fetch` 仅支持 git 协议，非 git 协议报错 `"fetch for protocol {x} is not yet implemented"`
- FileDriver 实现后，`avfs fetch avfs://file/...` 是最自然的测试场景
- FileDriver 的 `read()` 返回 `ReadableStream<Uint8Array>`，与 GitDriver 完全一致——`fetch.command.ts` 的 stdout/`-o` 管道代码可复用
- 非 git 协议的 fetch 需要在 `fetch.command.ts` 中添加协议分发逻辑

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
|:----:|------|------|------|
| A | 扩展 fetch 支持 file 协议：`avfs fetch avfs://file/...` → stdout/`-o` 输出 | 自然扩展，无新增接口；file 是最常见的用户场景 | 需要修改 fetch.command.ts 添加协议路由 |
| B | 扩展 fetch 支持 file + git 两个协议：统一协议分发模式 | 为后续 http/https/smb fetch 铺路 | 需要更完整的协议路由设计 |
| C | 保持 fetch 仅 git：file 协议只提供 stat 查询 | 改动最小 | 浪费了 fileread 能力 |

**推荐**：✅ 选项 B — 扩展 fetch 支持 file + git 两个协议，建立统一的协议分发框架

**确认理由**（用户选择）：
1. file 协议的 fetch 实现简单（`fs.createReadStream` → pipeline → stdout/`-o`）
2. 通过"协议-驱动分发"模式将 fetch.command.ts 改造为协议无关的驱动路由器，为后续 http/https/smb fetch 预留扩展点
3. FT-002 已有"非 git 协议报错"的代码，改为分发后仅需将 file 路由到 FileDriver，git 路由到 GitDriver，其余仍报错

**状态**：✅ 已确认（Option B — file + git 双协议，统一分发框架）

---

## 决策汇总

| # | 决策 | 推荐方案 | 状态 |
| --- | ------ | ---------- | ------ |
| 1 | Driver 接口演进策略 | **C — 一步到位**：完整 AVFSDriver 接口（元数据+生命周期+Connection+ParsedAddress+全部错误类型） | ✅ 已确认 |
| 2 | File Driver 可选方法实现范围 | **A — 核心 + exists + list**（不含 write/delete） | ✅ 已确认 |
| 3 | avfs stat 行为 | **A — 直接调用驱动**：始终输出 `ResourceMetadata`，未实现时抛 `NotImplementedError` | ✅ 已确认 |
| 4 | 错误类型标准化 | **B — 4+1 种核心类型**（NotFound/Permission/Timeout/Connection/NotImplemented） | ✅ 已确认 |
| 5 | File Driver 安全边界 | **A — 不限制**：允许 ../ 遍历，不做沙箱 | ✅ 已确认 |
| 6 | avfs fetch 扩展 | **B — file + git 双协议**，建立驱动分发框架 | ✅ 已确认 |

---

## 回答记录

> 以下由用户逐一回答后填写

| 决策点 | 选择 | 时间戳 | 备注 |
|:-----:|:-----:|:------:|:------|
| DP1 | Option C（一步到位：完整 AVFSDriver 接口） | 2026-06-14T12:00:00Z | User selected full implementation over gradual evolution |
| DP2 | Option A（核心 + exists + list，不含 write/delete） | 2026-06-17T15:36:00Z（修正） | 确认 list?() 在协议规范中存在；write/delete 无 CLI 命令入口，暂不实现 |
| DP3 | Option A（直接调用驱动 stat()，输出统一 ResourceMetadata） | 2026-06-17T15:38:00Z | 统一输出格式，未实现时抛 NOT_IMPLEMENTED 标准错误 |
| DP4 | Option B（4+1 种：NotFound/Permission/Timeout/Connection/NotImplemented） | 2026-06-17T15:42:00Z | 精简错误体系，追加 NotImplementedError 满足 DP3
| DP5 | Option A（不限制，允许 ../ 遍历，不做沙箱） | 2026-06-17T15:45:00Z | 路径遍历风险在当前场景可控，保持极简实现
| DP6 | Option B（file + git 双协议，统一分发框架） | 2026-06-17T15:44:00Z | 为后续 http/https/smb fetch 铺路

---

## 关联文档

- [项目总体计划](../../overall-plan.md) — 项目规划总览
- [FT-002 AskMe](../FT-002-git-address-parsing/FT-002-git-address-parsing-AskMe.md) — 前序特性决策记录
- [FT-002 PRD](../FT-002-git-address-parsing/FT-002-git-address-parsing-PRD.md) — 包含 GitDriver 实现的完整规格
- [Driver Interface 规范 (EN)](../../../../docs/contents/en-us/spec/driver-interface.md) — 当前文档中定义的 AVFSDriver 接口
- [Driver Interface 规范 (CN)](../../../../docs/contents/zh-cn/spec/driver-interface.md) — 同上（中文）
- [当前 Driver 接口代码](../../../../cli/src/drivers/driver.interface.ts) — 当前代码实现
- [当前 GitDriver（唯一生产驱动）](../../../../cli/src/drivers/git.driver.ts) — FT-002 实现的参考
- [当前 FileDriver stub](../../../../cli/src/drivers/file.driver.ts)
- [当前 stat 命令](../../../../cli/src/commands/stat.command.ts)
- [当前 fetch 命令](../../../../cli/src/commands/fetch.command.ts)

### 已完成的 docs-vs-code 文档更新（前置工作）

以下文件已在 FT-002 完成后更新为与代码一致，作为 FT-003 的前置依赖：

| 文件 | 更新内容 |
|------|----------|
| `docs/contents/en-us/spec/avfs-v1-standard.md` | `@version` → `?ref=`、SMB resourceBase、CLI 命令 |
| `docs/contents/zh-cn/spec/avfs-v1-standard.md` | 同上（中文） |
| `docs/contents/en-us/spec/conversion-rules.md` | Git 示例版本语法、SMB 算法、移除 batch |
| `docs/contents/zh-cn/spec/conversion-rules.md` | 同上（中文） |
| `docs/contents/en-us/spec/address-syntax.md` | SMB resourceBase 定义 |
| `docs/contents/zh-cn/spec/address-syntax.md` | 同上（中文） |
| `docs/contents/en-us/spec/README.md` | Git 示例 URI |
| `docs/contents/en-us/spec/authentication.md` | 代码示例版本语法 |
| `docs/contents/zh-cn/spec/authentication.md` | 同上（中文） |
| `skills/avfs-skill/SKILL.md` | 全文版本语法、SMB、CLI 选项、Node版本 |
| `skills/README.md` | 示例引用 |
| `docs/README.md` | 文件计数 |
| **`docs/contents/*/spec/driver-interface.md`** | **❌ 待 FT-003 完成后更新** |

---

**文档版本**：0.2
**创建日期**：2026-05-27
**最后更新**：2026-06-17（全部 6 个决策点确认完成）
**维护者**：AI Agent (qahc-harness)
