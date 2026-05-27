# FT-003 Driver 接口标准化 + File 驱动实现 — 需求访谈追问

> 本文档记录对 FT-003 Driver 接口标准化与核心驱动实现特性的逐问题追问，用于澄清需求模糊点后制定最终需求规格。

**创建日期**：2026-05-27
**负责人**：Lei Xu
**状态**：待回答

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
| `cli/src/drivers/file.driver.ts` | 从 stub 替换为本地文件系统实现（connect/read/stat/close） |
| `cli/src/drivers/git.driver.ts` | 适配新接口变更（如有） |
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

**状态**：⏳ 待确认

---

### 决策点 2：File Driver 实现范围

**问题**：File Driver 应支持哪些操作？是否需要支持目录遍历？

**背景**：
- FileDriver 是 5 个驱动中最简单的（直接基于 POSIX `fs` 模块），是实现成本最低的验证选择
- 当前 Driver 接口定义 `read(filePath)` 返回 `ReadableStream<Uint8Array>`，`stat(filePath)` 返回 `FileMetadata`
- 文档（`driver-interface.md`）定义了 `list()`（目录遍历）作为可选方法
- File protocol 是最容易实现 `stat()` 完整元数据的协议（`fs.statSync` 可获取 size/mtime/MIME）
- `avfs fetch` 当前仅支持 git 协议，不支持 file 协议（报错 "not yet implemented"）

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 仅 read + stat：实现文件读取（stdout `ReadableStream`）和元数据获取（`fs.statSync` → `FileMetadata`） | 最小有效可交付单元，快速打通 file 协议的 stat/fetch | 不支持目录遍历 |
| B | read + stat + list：额外支持目录列表（`fs.readdir` → `Entry[]`） | 功能更完整，`avfs stat` 对目录也能返回信息 | 需要扩展 Driver 接口添加 `list?()` 方法，引入额外复杂度 |
| C | read + stat + list + write：完整 CRUD | 覆盖文档中定义的全部文件操作 | 范围过大，write 操作引入安全考量 |

**推荐**：✅ 选项 A — read + stat，聚焦文件读取和元数据获取

**确认理由**：
1. read + stat 是最小可验证单元，100% 复用现有 Driver 接口，零接口变更
2. `avfs fetch avfs://file/...` 和 `avfs stat avfs://file/...` 具备独立可用性，无需等待其他协议
3. list/write 是纯增量能力，可在后续特性中无缝追加，不阻塞当前基线

**状态**：⏳ 待确认

---

### 决策点 3：`avfs stat` 行为 —— 元数据连接 vs 保持解析

**问题**：`avfs stat` 应改为连接驱动获取文件元数据，还是保持仅输出地址解析结果？

**背景**：
- **当前代码**：`avfs stat` 调用 `parseAvfsUri()` → 输出 `ParsedAddress` JSON（protocol/resourceBase/version/filePath/anchor）
- **文档/用户期望**：`avfs stat` 应返回文件元数据（size/MIME type/timestamps），类似于 `ls -l` 或 `docker inspect`
- GitDriver 已实现 `stat()` 返回 `FileMetadata`（通过 GitHub API Contents endpoint JSON），但 CLI 未调用
- Non-git 驱动（file/http/https/smb）的 `stat()` 目前全部 throw "Not implemented"
- 对 AI Agent 场景，文件大小和 MIME 类型比地址解析字段更重要

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 保持现状：`avfs stat` 仅输出 `ParsedAddress` JSON（不做文件元数据查询） | 不变更现有行为，零回归风险 | 浪费了 GitDriver 已实现的 stat 能力，用户无法获取文件元数据 |
| B | 渐进连接：`avfs stat` 先尝试调用驱动 `stat()`，驱动未实现时回退到纯地址解析输出 | 逐步增强，不破坏已有可用性；非 git 协议暂时回到地址解析，等各自驱动实现后自动升级 | 输出格式不统一（git 返回 FileMetadata vs file 返回 ParsedAddress），对 Agent 解析有歧义 |
| C | 统一增强：`avfs stat` 改为始终调用驱动 `stat()`，驱动未实现时报友好错误（"stat not yet available for {protocol}"） | 输出格式统一（全部返回 FileMetadata 或错误），语义清晰 | file/http/https/smb 的 `avfs stat` 将不可用，直到各驱动实现（丧失"地址解析器"的兜底价值） |

**推荐**：✅ 选项 B — 渐进连接：驱动可用时返回元数据，不可用时回退到地址解析

**确认理由**：
1. 对已实现的协议（git→GitDriver）立即获得增强能力，`avfs stat avfs://git/...` 可获取文件大小/类型/时间
2. 对未实现的协议（file/http/https/smb）保持 `avfs stat` 的地址解析兜底价值，不引入破坏性变更
3. 输出结构中增加 `_source` 字段区分数据来源（`driver` vs `parser`），消除 Agent 解析歧义
4. 符合 FT-002 的渐进式策略——能力逐协议点亮，而非一步到位

**状态**：⏳ 待确认

---

### 决策点 4：错误类型标准化

**问题**：是否引入标准化错误类型（如 `NotFoundError`/`PermissionError`/`TimeoutError`），还是继续使用普通 `Error`？

**背景**：
- **当前代码**：GitDriver 使用普通 `Error("File not found: {path}")` 抛出错误，AI Agent 需通过错误消息字符串匹配来判定错误类别
- **当前文档**：定义了 9 种 `AVFSError` 子类，每种有独立 `code`（如 `NOT_FOUND`、`AUTH_FAILED`）
- AI Agent 对错误分类的需求明确：404（文件不存在）、403（限流）、超时（网络）需要不同处理策略
- GitDriver 已实现了 3 种错误分类（404/403/网络超时），但通过字符串差异区分，不够规范化
- File driver 需要 `ENOENT`（文件不存在）、`EACCES`（权限不足）、`EISDIR`（目录）等错误处理

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 保持普通 Error | 零新增代码，GitDriver 当前模式已验证可行 | AI Agent 必须做脆弱的字符串匹配；未来驱动增多后难以统一 |
| B | 引入精简错误类型体系（4 种） | 覆盖当前已知错误场景，成本极低；GitDriver 和 FileDriver 直接受益 | 与文档中 9 种类型不一致，但可以先交付后补全 |
| C | 引入完整 9 种错误类型 | 与文档完全一致，一步到位 | 大部分类型（WriteError/DeleteError/DriverInitError）当前无使用场景，属于过度设计 |

**推荐**：✅ 选项 B — 引入 4 种核心错误类型：`NotFoundError`、`PermissionError`、`TimeoutError`、`ConnectionError`，均继承 `AVFSError(code, message)`

**确认理由**：
1. 4 种类型覆盖了当前 GitDriver + FileDriver 的所有错误场景（404/403/超时/网络/ENOENT/EACCES）
2. 为 AI Agent 提供字符串独立（string-independent）的错误分类能力，大幅提升可靠性
3. 剩余 5 种类型（ReadError/WriteError/DeleteError/InvalidAddressError/DriverInitError）可在未来实际遇到时增量追加，不增加当前交付成本
4. `AVFSError` 作为基类为后续扩展预留 `code` 字段

**状态**：⏳ 待确认

---

### 决策点 5：File Driver 的安全边界

**问题**：File Driver 的路径访问应限制在什么范围内？是否需要沙箱机制？

**背景**：
- File Driver 通过 `avfs://file/...` 地址访问本地文件，`resourceBase` 是磁盘路径段
- 当前协议规范中 AVFS address 不区分绝对路径和相对路径——`avfs://file/home/user/file.txt` 和 `avfs://file/../etc/passwd` 按相同规则解析
- `../` 向上级目录遍历是一个潜在的安全问题，可能导致访问非预期文件
- FT-002 的 GitDriver 天然受限于 GitHub API 的仓库范围，无此类顾虑

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 不限制：遵循当前解析规则，允许 `../` 遍历，不做沙箱 | 实现极简，与解析器行为完全一致 | 安全性完全依赖用户输入质量；对 AI Agent 自动执行的场景有路径遍历风险 |
| B | 路径规范化：解析 `../` 和 `./` 为规范路径后，确保最终路径在 `resourceBase` 指定的根目录内（如 `avfs://file/avfs/home/user` → 根目录为 `/home/user`，禁止 `../../../etc/passwd` 逃逸） | 安全且符合 Unix 文件系统语义 | 需要定义 resolve 逻辑；avfs URI 的 resourceBase 和 filePath 拆分模式可能导致根目录边界定义模糊 |
| C | 配置化沙箱：支持通过配置指定 `resourceBase` 白名单（如仅允许访问 `/home/project1` 和 `/var/data`） | 完整的安全模型，企业级 | 引入配置系统，范围大；当前 CLI 不支持配置文件解析 |

**推荐**：✅ 选项 B — 路径规范化 + 根目录约束，禁止逃逸出 `resourceBase` 指定的根范围

**确认理由**：
1. `avfs://file/home/user` 语义上应限定在 `/home/user/` 路径树内，符合最小权限原则
2. Node.js `path.resolve()` 可实现简单的规范化，无需引入额外依赖
3. 根目录边界定义：`resourceBase`（首个路径段如 `home`）→ 解析为 `/{resourceBase}` = `/home` 作为根；`connect()` 时记录此根，后续 `read()/stat()` 的 `filePath` 相对此根解析，且规范化后不得逃逸
4. 与 GitDriver 的仓库级隔离理念一致——GitDriver 限制在指定仓库内，FileDriver 限制在指定目录内

**状态**：⏳ 待确认

---

### 决策点 6：`avfs fetch` 扩展 —— file 协议支持

**问题**：File Driver 实现后，`avfs fetch` 是否应支持 file 协议？如果需要，应支持到什么程度？

**背景**：
- FT-002 中 `avfs fetch` 仅支持 git 协议，非 git 协议报错 `"fetch for protocol {x} is not yet implemented"`
- FileDriver 实现后，`avfs fetch avfs://file/...` 是最自然的测试场景
- FileDriver 的 `read()` 返回 `ReadableStream<Uint8Array>`，与 GitDriver 完全一致——`fetch.command.ts` 的 stdout/`-o` 管道代码可复用
- 非 git 协议的 fetch 需要在 `fetch.command.ts` 中添加协议分发逻辑（类似 convert.command.ts 的模式）

**选项**：

| 选项 | 描述 | 优点 | 缺点 |
| ------ | ------ | ------ | ------ |
| A | 扩展 fetch 支持 file 协议：`avfs fetch avfs://file/...` → stdout/`-o` 输出 | 自然扩展，无新增接口；file 是最常见的用户场景 | 需要修改 fetch.command.ts 添加协议路由 |
| B | 扩展 fetch 支持 file + git 两个协议：统一协议分发模式 | 为后续 http/https/smb fetch 铺路 | 需要更完整的协议路由设计 |
| C | 保持 fetch 仅 git：file 协议只提供 stat 查询 | 改动最小 | 浪费了 fileread 能力；用户期望 `avfs fetch avfs://file/...` 工作 |

**推荐**：✅ 选项 B — 扩展 fetch 支持 file + git 两个协议，建立统一的协议分发框架

**确认理由**：
1. file 协议的 fetch 实现简单（`fs.createReadStream` → pipeline → stdout/`-o`），30 行代码即可完成
2. 通过"协议-驱动分发"模式（类似 FT-002 的 converter 策略模式）将 fetch.command.ts 改造为协议无关的驱动路由器，为后续 http/https/smb fetch 预留扩展点
3. FT-002 已有"非 git 协议报错"的代码，改为分发后仅需将 file 路由到 FileDriver，git 路由到 GitDriver，其余仍报错

**状态**：⏳ 待确认

---

## 决策汇总

| # | 决策 | 推荐方案 | 状态 |
| --- | ------ | ---------- | ------ |
| 1 | Driver 接口演进策略 | **B — 渐进演进**：补充元数据 + 标准化错误，保持简单方法签名 | ⏳ 待确认 |
| 2 | File Driver 实现范围 | **A — read + stat** 最小可用交付 | ⏳ 待确认 |
| 3 | avfs stat 行为 | **B — 渐进连接**：驱动可用→元数据，不可用→地址解析回退 | ⏳ 待确认 |
| 4 | 错误类型标准化 | **B — 4 种核心错误类型**（NotFound/Permission/Timeout/Connection） | ⏳ 待确认 |
| 5 | File Driver 安全边界 | **B — 路径规范化 + 根目录约束**，禁止逃逸 | ⏳ 待确认 |
| 6 | avfs fetch 扩展 | **B — file + git 双协议**，建立驱动分发框架 | ⏳ 待确认 |

---

## 回答记录

> 以下由用户逐一回答后填写

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
**最后更新**：2026-05-27（补充完整差异分析来源 + 已完成前置工作清单）
**维护者**：AI Agent (qahc-harness)
