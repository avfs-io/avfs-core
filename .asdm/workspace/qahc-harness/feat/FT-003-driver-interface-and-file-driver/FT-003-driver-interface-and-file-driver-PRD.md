# FT-003 Driver 接口标准化 + File 驱动实现 — PRD 产品需求文档

> **🔗 前置依赖**：本文档基于 [FT-003-driver-interface-and-file-driver-AskMe.md](./FT-003-driver-interface-and-file-driver-AskMe.md)（需求访谈文档）编写。

> 最后更新：2026-06-17

---

## 修订记录

| 版本 | 日期 | 修订人 | 修订内容 |
| ------ | ------ | -------- | ---------- |
| 1.0.0 | 2026-06-17 | AI Agent | 初始版本 |
| 1.0.1 | 2026-06-17 | AI Agent | 修正场景一定位为用户场景；新增场景五跨平台文件访问；修正 POSIX 限定措辞、错误类型数量与可选方法范围的一致性 |
| 1.1.0 | 2026-06-17 | AI Agent | 阶段二详细设计补充：技术方案、数据模型、接口设计、依赖关系、风险与缓解、验收条件 (DoD) |

---

## 目录

- [1. 总体概述](#1-总体概述)
- [2. 使用场景](#2-使用场景)
- [3. 技术方案](#3-技术方案)
- [4. 数据模型](#4-数据模型)
- [5. 接口设计](#5-接口设计)
- [6. 依赖关系](#6-依赖关系)
- [7. 风险与缓解](#7-风险与缓解)
- [8. 验收条件 (DoD)](#8-验收条件-dod)

---

## 1. 总体概述

### 1.1 背景与目标

**背景**：FT-002（Git 地址解析）实现完成后，对代码实现与协议规范文档进行了逐项对比分析，发现 Driver 接口层存在显著的代码-文档差异。当前 `cli/src/drivers/driver.interface.ts` 仅定义了简化的 4 方法接口（`connect`/`read`/`stat`/`close`，纯 string 参数、void 返回、普通 Error），而协议规范 `driver-interface.md` 定义了完整的 `AVFSDriver` 接口（含元数据字段、生命周期、Connection 对象、ParsedAddress 参数、标准化错误类型、可选方法）。此外，当前 `avfs stat` 命令仅输出地址解析结果（`ParsedAddress` JSON），未调用底层驱动获取文件元数据。

**目标**：
1. 将 Driver 接口从简化版升级为与文档一致的**完整 AVFSDriver 接口**，为后续 http/https/smb 驱动实现提供统一基线
2. 实现 **file 协议驱动**（本地文件系统）作为首个非 git 的参考实现，验证接口完备性
3. 让 **`avfs stat`** 连接真实驱动输出文件元数据（`ResourceMetadata`），而非仅地址解析
4. 让 **`avfs fetch`** 支持 file 协议，建立统一的协议-驱动分发框架

### 1.2 核心概念

| 概念 | 说明 |
|------|------|
| **AVFSDriver 接口** | 协议规范定义的完整驱动契约，包含元数据字段（protocol/version/displayName/description）、生命周期（initialize/destroy）、核心操作（connect→Connection、stat→ResourceMetadata、read with ParsedAddress+ReadOptions）、可选方法（list/exists，write/delete 由后续特性按需追加） |
| **FileDriver** | file 协议（`avfs://file/...`）的参考实现，基于 Node.js `fs` 模块（跨平台兼容 Linux/macOS/Windows），实现核心 + 可选方法（initialize/destroy/connect/stat/read/list/exists） |
| **ResourceMetadata** | 标准化资源元数据模型（9+ 字段：name/path/size/mimeType/contentType/lastModified/etag/checksum/permissions） |
| **标准化错误类型** | 5 种核心错误：`NotFoundError`(NOT_FOUND)、`PermissionError`(FORBIDDEN)、`TimeoutError`(TIMEOUT)、`ConnectionError`(CONNECTION_ERROR)、`NotImplementedError`(NOT_IMPLEMENTED)，均继承自 `AVFSError(code, message)` |
| **协议-驱动分发** | CLI 命令（stat/fetch）根据协议标识符将请求路由到对应驱动的统一调度模式，取代硬编码的协议特定逻辑 |

### 1.3 变更范围

| 变更模块 | 变更类型 | 变更描述 |
| ---------- | :--------: | ---------- |
| `cli/src/drivers/driver.interface.ts` | 修改 | 从简化 4 方法升级为完整 AVFSDriver 接口，含元数据字段、生命周期方法、Connection 返回、ParsedAddress 参数、ResourceMetadata 元数据模型 |
| `cli/src/drivers/file.driver.ts` | 修改 | 从 stub 替换为本地文件系统实现，含 initialize/destroy/connect/stat/read/list/exists |
| `cli/src/drivers/git.driver.ts` | 修改 | 适配新 AVFSDriver 接口签名（ParsedAddress 参数、Connection 返回、ResourceMetadata、标准化错误类型） |
| `cli/src/commands/stat.command.ts` | 修改 | 从仅输出 ParsedAddress JSON 改为调用驱动 stat() 输出 ResourceMetadata，未实现时抛 NotImplementedError |
| `cli/src/commands/fetch.command.ts` | 修改 | 建立协议-驱动分发框架，支持 file + git 双协议 fetch |
| `cli/test/` | 新增 | 新增 file.driver.test.ts + 更新 GitDriver 测试 |
| `docs/contents/*/spec/driver-interface.md` | 修改 | 以代码实现为准，统一中英文规范文档与接口定义对齐 |

### 1.4 关键决策

| # | 决策点 | 决策结论 | 理由摘要 |
| --- | ------ | ---------- | ---------- |
| 1 | Driver 接口演进策略 | **C — 一步到位**：完整 AVFSDriver 接口（元数据+生命周期+Connection+ParsedAddress+全部错误类型） | 接口一步到位，后续无需再改；FT-003 本身的变更范围已涵盖全量接口升级 |
| 2 | File Driver 可选方法 | **A — 核心 + exists + list**（不含 write/delete） | exists 和 list 实现成本极低（各 3-5 行）；write/delete 当前 CLI 无命令入口且引入安全攻击面 |
| 3 | avfs stat 行为 | **A — 直接调用驱动**：统一输出 ResourceMetadata，未实现时抛 NotImplementedError | 统一输出格式减少 Agent 解析歧义；NotImplementedError 给出明确的错误类别 |
| 4 | 错误类型标准化 | **B — 4+1 种**：NotFound/Permission/Timeout/Connection + NotImplemented | 覆盖当前所有错误场景；剩余类型可在实际遇到时增量追加，不增加交付成本 |
| 5 | File Driver 安全边界 | **A — 不限制**：允许 ../ 遍历，不做沙箱 | 实现极简，与解析器行为一致；Agent 场景下 resourceBase 由配置构造而非随机用户输入 |
| 6 | avfs fetch 扩展 | **B — file + git 双协议**：统一协议分发框架 | 为后续 http/https/smb fetch 预留扩展点；file 路由到 FileDriver，git 路由到 GitDriver |

---

## 2. 使用场景

### 2.1 场景一：用户通过 file 协议列出目录内容

**角色**：AI Agent 或终端用户
**前置条件**：FileDriver 已实现并注册，目标目录存在且可读

**操作步骤**：
1. 用户执行 `avfs stat avfs://file/home/user/projects/`
2. CLI 解析地址获取 ParsedAddress（protocol=file, resourceBase=home, filePath=user/projects/）
3. 插件注册表按 protocol=file 匹配到 FileDriver
4. FileDriver 识别目标路径为目录，调用 `list(ParsedAddress)` 返回子条目列表
5. 输出 `Entry[]` JSON，每项包含 name/path/type/size/lastModified 字段

**预期结果**：用户获得目录下所有文件/子目录的元数据列表，而非仅地址解析字段

---

### 2.2 场景二：用户通过 file 协议获取文件元数据

**角色**：AI Agent 或终端用户
**前置条件**：FileDriver 已实现并注册

**操作步骤**：
1. 用户执行 `avfs stat avfs://file/home/user/config.json`
2. CLI 解析地址获取 ParsedAddress（protocol=file, resourceBase=home, filePath=user/config.json）
3. 插件注册表按 protocol=file 匹配到 FileDriver
4. FileDriver 调用 `fs.statSync('/home/user/config.json')` 获取文件元数据
5. 返回 `ResourceMetadata` JSON，含 size/mimeType/contentType/lastModified/permissions 等字段

**预期结果**：`avfs stat` 输出完整的文件元数据，而非仅地址解析字段

---

### 2.3 场景三：用户通过 file 协议获取文件内容

**角色**：AI Agent 或终端用户
**前置条件**：FileDriver 已实现并注册

**操作步骤**：
1. 用户执行 `avfs fetch avfs://file/home/user/config.json -o ./output.json`
2. CLI 解析地址并按协议分发到 FileDriver
3. FileDriver 调用 `fs.createReadStream('/home/user/config.json')` 获取可读流
4. 流通过 pipeline 写入 `-o` 指定文件（或输出到 stdout）

**预期结果**：文件内容成功读取，支持所有协议统一的 `-o` 输出选项

---

### 2.4 场景四：AI Agent 处理跨协议 stat 错误

**角色**：AI Agent 使用 AVFS 访问多种协议资源
**前置条件**：标准化错误类型已实现

**操作步骤**：
1. Agent 执行 `avfs stat avfs://https/intranet.company.com/data.json`
2. CLI 解析地址、匹配 HttpsDriver
3. HttpsDriver 当前为 stub，`stat()` 抛出 `NotImplementedError(code='NOT_IMPLEMENTED')`
4. Agent 捕获 `NotImplementedError`，据此判断 https:// 协议的 stat 暂不可用
5. Agent 向用户反馈："https 协议的元数据查询暂未实现，建议使用 git 或 file 协议"

**预期结果**：Agent 通过标准错误类型代码（而非字符串匹配）做出正确的降级决策

---

### 2.5 场景五：跨平台文件访问

**角色**：AI Agent 或终端用户
**前置条件**：FileDriver 已实现并注册，Linux/macOS/Windows 均已安装 avfs CLI

**操作步骤**：
1. **Linux 环境**：用户执行 `avfs stat avfs://file/home/user/docs/report.pdf`
   - FileDriver 调用 `path.resolve('/home/user/docs/', 'report.pdf')` → `/home/user/docs/report.pdf`
   - `fs.statSync('/home/user/docs/report.pdf')` 返回文件元数据
2. **macOS 环境**：用户执行 `avfs stat avfs://file/Users/alice/docs/report.pdf`
   - FileDriver 调用 `path.resolve('/Users/alice/docs/', 'report.pdf')` → `/Users/alice/docs/report.pdf`
   - `fs.statSync('/Users/alice/docs/report.pdf')` 返回文件元数据
3. **Windows 环境**：用户执行 `avfs stat avfs://file/C/Users/alice/docs/report.pdf`
   - FileDriver 调用 `path.resolve('C:\\Users\\alice\\docs\\', 'report.pdf')` → `C:\Users\alice\docs\report.pdf`
   - `fs.statSync('C:\\Users\\alice\\docs\\report.pdf')` 返回文件元数据

**预期结果**：
- 三个平台使用统一的 `avfs stat` 命令语法，仅地址路径不同
- Node.js `path` 模块自动处理各平台路径分隔符（`/` vs `\`）
- `fs.statSync` 返回的 `ResourceMetadata` 字段结构完全一致（size/mtime/permissions 等）
- `avfs fetch` 同理跨平台可用

---

<!-- 阶段二补充：技术方案、数据模型、接口设计、依赖关系、风险与缓解、验收条件 (DoD) -->

---

## 3. 技术方案

> 基于 [CodeResearch 调研报告](./FT-003-driver-interface-and-file-driver-CodeResearch-cli-drivers.md) 的代码现状分析，制定以下技术方案。

### 3.1 Driver 接口升级策略

**方案**：一步到位升级 `Driver` → `AVFSDriver`（DP1 Option C），包含元数据字段、生命周期方法、Connection 返回、ParsedAddress 参数、标准化错误类型、可选方法。

**变更文件**：`cli/src/drivers/driver.interface.ts`

**升级路径**：

| 维度 | 当前 | 升级后 |
|------|------|--------|
| 接口名 | `Driver` | `AVFSDriver`（保留 `Driver` 作为类型别名兼容） |
| 元数据 | `protocol: string` | `protocol`/`version`/`displayName`/`description` |
| 生命周期 | 无 | `initialize(config: DriverConfig)`/`destroy()` |
| connect | `connect(resourceBase: string, options?) → void` | `connect(address: ParsedAddress) → Connection` |
| stat | `stat(filePath: string) → FileMetadata` | `stat(address: ParsedAddress) → ResourceMetadata` |
| read | `read(filePath: string) → ReadableStream` | `read(address: ParsedAddress, options?: ReadOptions) → ReadableStream` |
| 可选方法 | 无 | `list?`/`exists?`（DP2，不含 write/delete） |
| close | `close(): Promise<void>` | 移除（由 `destroy()` + `Connection.close()` 替代） |
| 错误 | plain `Error` | `AVFSError` 基类 + 5 种子类（DP4） |
| 元数据模型 | `FileMetadata`（4 字段） | `ResourceMetadata`（11 字段） |

### 3.2 标准化错误类型设计

**新增文件**：`cli/src/drivers/errors.ts`

实现 `AVFSError` 基类 + 5 种子类（DP4 决策）：

| 错误类 | code | 触发场景 | FileDriver 使用 | GitDriver 使用 |
|--------|------|----------|:---:|:---:|
| `AVFSError` | — | 基类，不直接使用 | — | — |
| `NotFoundError` | `NOT_FOUND` | 文件/资源不存在（fs ENOENT / HTTP 404） | ✅ | ✅ |
| `PermissionError` | `FORBIDDEN` | 权限不足（fs EACCES / HTTP 403） | ✅ | ✅ |
| `TimeoutError` | `TIMEOUT` | 网络/IO 超时 | — | ✅ |
| `ConnectionError` | `CONNECTION_ERROR` | 连接失败（DNS/refused） | — | ✅ |
| `NotImplementedError` | `NOT_IMPLEMENTED` | 方法未实现（stub 驱动） | ✅ | — |

基类设计：

| 属性 | 类型 | 说明 |
|------|------|------|
| `code` | `string` | 标准化错误代码（如 `'NOT_FOUND'`） |
| `message` | `string` | 人类可读错误消息（继承自 Error） |
| `cause` | `Error` (optional) | 原始错误对象（保留调用链） |

### 3.3 FileDriver 实现方案

**变更文件**：`cli/src/drivers/file.driver.ts`（从桩替换为完整实现）

**依赖模块**：`node:fs`、`node:path`、`node:stream`、`node:crypto`（均为 Node.js 内置，零新增依赖）

**方法实现**：

| 方法 | 实现方式 | 错误处理 |
|------|----------|----------|
| `initialize(config)` | no-op（本地 fs 无需初始化），幂等 | — |
| `destroy()` | no-op（无资源需释放），安全多次调用 | — |
| `connect(address)` | 将 `address.resourceBase` + `address.filePath` 拼装为绝对路径，存入私有字段，返回轻量 Connection 对象 | 路径不可访问时抛 `NotFoundError` |
| `stat(address)` | `fs.statSync(absPath)` → 映射为 `ResourceMetadata`；目录类型额外填充 `type` 信息 | ENOENT → `NotFoundError`，EACCES → `PermissionError` |
| `read(address)` | `fs.createReadStream(absPath)` → `Readable.toWeb()` 转为 Web `ReadableStream<Uint8Array>` | ENOENT → `NotFoundError`，EACCES → `PermissionError` |
| `list(address)` | `fs.readdirSync(absPath, { withFileTypes: true })` → 映射为 `Entry[]`，按名称排序（目录优先） | ENOENT → `NotFoundError`，ENOTDIR → `NotFoundError` |
| `exists(address)` | `fs.existsSync(absPath)` → `boolean` | 无异常抛出 |

**路径拼装规则**：
- `absPath = path.resolve(address.resourceBase, address.filePath)`
- `path.resolve` 自动处理跨平台路径分隔符（`/` vs `\`）
- 不做路径遍历限制（DP5 决策）

**ResourceMetadata 字段映射**（fs.Stats → ResourceMetadata）：

| ResourceMetadata 字段 | 来源 |
|----------------------|------|
| `name` | `path.basename(absPath)` |
| `path` | `address.filePath` |
| `size` | `stats.size` |
| `mimeType` | 扩展名推断（复用 GitDriver 的 `inferMimeType` 工具函数） |
| `contentType` | 同 `mimeType` |
| `lastModified` | `stats.mtime` |
| `created` | `stats.birthtime`（Windows/ext4 支持，FAT 不支持时为 mtime） |
| `permissions` | `stats.mode` 转八进制字符串（如 `"0644"`） |
| `etag`/`checksum` | 可选：`crypto.createHash('sha256')` 计算（性能考虑，默认不计算） |
| `version` | `null`（file 协议无版本概念） |
| `extra` | `{ isDirectory: stats.isDirectory(), protocol: 'file' }` |

### 3.4 GitDriver 适配方案

**变更文件**：`cli/src/drivers/git.driver.ts`

**适配要点**：

| 方法 | 当前签名 | 新签名 | 适配说明 |
|------|----------|--------|----------|
| 元数据 | `protocol = 'git'` | + `version`/`displayName`/`description` | 新增 3 个 readonly 属性 |
| `initialize` | 无 | `initialize(config: DriverConfig)` | no-op（GitHub API 无状态） |
| `destroy` | 无 | `destroy()` | 重置 owner/repo/version（原 close 逻辑） |
| `connect` | `connect(resourceBase, options?) → void` | `connect(address: ParsedAddress) → Connection` | 从 `address.resourceBase` 解析 owner/repo，从 `address.version` 读取版本（移除 credentials hack） |
| `stat` | `stat(filePath) → FileMetadata` | `stat(address: ParsedAddress) → ResourceMetadata` | 补充 name/path/contentType/lastModified 等字段 |
| `read` | `read(filePath) → ReadableStream` | `read(address: ParsedAddress, options?) → ReadableStream` | 参数改为 ParsedAddress |
| `close` | `close(): Promise<void>` | 移除（由 destroy 替代） | — |
| 错误处理 | `new Error(classifyHttpError(...))` | `new NotFoundError(...)`/`new PermissionError(...)`/`new TimeoutError(...)`/`new ConnectionError(...)` | 按状态码映射到标准化错误类型 |

**错误映射**：

| HTTP 状态码 / 场景 | 当前错误消息 | 新错误类型 |
|-------------------|-------------|-----------|
| 404 | `"File not found: ..."` | `NotFoundError` |
| 403 | `"GitHub API rate limit exceeded..."` | `PermissionError` |
| 超时（AbortError） | `"Network error: ... (timed out)."` | `TimeoutError` |
| 网络失败（DNS/refused） | `"Network error: ..."` | `ConnectionError` |

### 3.5 桩驱动适配方案

**变更文件**：`http.driver.ts`、`https.driver.ts`、`smb.driver.ts`

每个桩驱动适配新接口：
- 新增元数据字段（`version`/`displayName`/`description`）
- 新增 `initialize`/`destroy` 生命周期方法（no-op）
- 所有核心方法抛出 `NotImplementedError(code='NOT_IMPLEMENTED')` 而非 `new Error('Not implemented')`
- 签名改为接收 `ParsedAddress` 参数

### 3.6 驱动分发框架

**新增文件**：`cli/src/drivers/registry.ts`

**设计**：

| 组件 | 说明 |
|------|------|
| `driverMap: Map<string, () => AVFSDriver>` | 协议标识符 → 驱动工厂函数映射 |
| `registerDriver(protocol, factory)` | 注册驱动工厂 |
| `getDriver(protocol): AVFSDriver` | 按协议获取驱动实例（每次调用创建新实例，因 GitDriver/FileDriver 无状态） |
| 预注册 | file → `() => new FileDriver()`，git → `() => new GitDriver()`，http/https/smb → 对应桩 |

**调用流程**（stat/fetch 命令）：
1. `parseAvfsUri(address)` → `ParsedAddress`
2. `getDriver(parsed.protocol)` → 驱动实例
3. `await driver.initialize({})` → 初始化
4. `await driver.stat(parsed)` 或 `await driver.read(parsed)` → 执行操作
5. `await driver.destroy()` → 清理

### 3.7 stat 命令改造方案

**变更文件**：`cli/src/commands/stat.command.ts`

**当前**：`parseAvfsUri(address)` → 输出 `ParsedAddress` JSON

**改造后**：
1. `parseAvfsUri(address)` → `ParsedAddress`
2. 校验 `parsed.isValid`，无效则报错退出
3. `getDriver(parsed.protocol)` → 驱动实例
4. `await driver.initialize({})` → 初始化
5. `await driver.stat(parsed)` → `ResourceMetadata`
6. 输出 `ResourceMetadata` JSON
7. 捕获 `NotImplementedError` → 输出明确错误（"协议 X 的 stat 暂未实现"）
8. `await driver.destroy()` → 清理

### 3.8 fetch 命令改造方案

**变更文件**：`cli/src/commands/fetch.command.ts`

**当前**：硬编码 `new GitDriver()`，非 git 协议报错

**改造后**：
1. `parseAvfsUri(address)` → `ParsedAddress`
2. 校验 `parsed.isValid` + `parsed.filePath` 非空
3. `getDriver(parsed.protocol)` → 驱动实例（替代硬编码 GitDriver）
4. `await driver.initialize({})` → 初始化
5. `await driver.read(parsed)` → `ReadableStream<Uint8Array>`
6. `Readable.fromWeb(stream)` → `pipeline()` → stdout/`-o` 文件（复用现有流处理逻辑）
7. `await driver.destroy()` → 清理
8. 移除 `credentials: { version }` hack（version 从 ParsedAddress 直接传递）

### 3.9 共享工具提取

**新增文件**：`cli/src/drivers/mime-utils.ts`

从 GitDriver 提取 `inferMimeType(filename: string): string` 为共享函数，供 FileDriver 和 GitDriver 复用。内置 22 种扩展名→MIME 映射表。

### 3.10 文档对齐方案

**变更文件**：`docs/contents/en-us/spec/driver-interface.md` + `docs/contents/zh-cn/spec/driver-interface.md`

以代码实现为准更新 spec：
- ParsedAddress：`raw` → `rawInput`，`filePath: string` → `filePath: string | null`，新增 `isValid`/`errors`
- file 驱动描述："POSIX I/O" → "Node.js fs 模块（跨平台兼容 Linux/macOS/Windows）"
- 错误类型：标注当前实现 5 种，其余增量追加
- 移除 `query?` 字段（代码不实现）

---

## 4. 数据模型

> 以下为 FT-003 涉及的核心类型定义。完整 TypeScript 定义见 §5 接口设计。

### 4.1 ParsedAddress（沿用代码版，更新 spec 对齐）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `protocol` | `ProtocolType \| string` | ✅ | 协议标识符（file/http/https/smb/git） |
| `resourceBase` | `string` | ✅ | 资源基址（如 `github.com/owner/repo`、`/home/user`） |
| `version` | `string \| null` | ✅ | 版本/分支/tag（仅 git，其余为 null） |
| `filePath` | `string \| null` | ✅ | 文件相对路径（可能为 null） |
| `anchor` | `string \| null` | ✅ | 锚点片段（# 之后） |
| `rawInput` | `string` | ✅ | 原始输入地址 |
| `isValid` | `boolean` | ✅ | 校验是否通过 |
| `errors` | `string[]` | ✅ | 校验错误列表 |

> 注：此类型已在 `cli/src/parser/types.ts` 中定义，FT-003 不修改 parser 层，仅将 spec 文档对齐。

### 4.2 ResourceMetadata（新增，替代 FileMetadata）

| 字段 | 类型 | 必填 | 说明 | FileDriver 来源 | GitDriver 来源 |
|------|------|:----:|------|----------------|---------------|
| `name` | `string` | ✅ | 文件/资源名称 | `path.basename()` | GitHub API `json.name` |
| `path` | `string` | ✅ | 相对路径 | `address.filePath` | `address.filePath` |
| `size` | `number` | ✅ | 文件大小（字节） | `stats.size` | `json.size` |
| `mimeType` | `string` | ✅ | MIME 类型 | 扩展名推断 | 扩展名推断 |
| `contentType` | `string` | ✅ | 内容类型（同 mimeType） | 同 mimeType | 同 mimeType |
| `lastModified` | `Date` | ✅ | 最后修改时间 | `stats.mtime` | `json.date` 或当前时间 |
| `created` | `Date` | ❌ | 创建时间 | `stats.birthtime` | — |
| `etag` | `string` | ❌ | 实体标签 | — | — |
| `checksum` | `string` | ❌ | SHA-256 校验和 | 可选计算 | — |
| `version` | `string` | ❌ | 版本标识 | — | `address.version` |
| `permissions` | `string` | ❌ | 八进制权限（如 `"0644"`） | `stats.mode` 转换 | — |
| `extra` | `Record<string, unknown>` | ❌ | 驱动特定扩展 | `{ isDirectory, protocol }` | `{ protocol }` |

### 4.3 Connection（新增）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `id` | `string` | ✅ | 连接唯一标识（UUID 或递增序号） |
| `createdAt` | `Date` | ✅ | 连接创建时间 |
| `protocol` | `string` | ✅ | 协议标识符 |
| `metadata` | `Record<string, unknown>` | ✅ | 连接元数据（驱动特定） |
| `close()` | `() => Promise<void>` | ✅ | 关闭连接 |
| `isOpen()` | `() => boolean` | ✅ | 连接是否打开 |

> FileDriver/GitDriver 的 Connection 为轻量实现（`isOpen` 总返回 true，`close` 为 no-op），满足接口契约。

### 4.4 Entry（新增，用于 list()）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `name` | `string` | ✅ | 条目名称 |
| `path` | `string` | ✅ | 相对路径 |
| `type` | `'file' \| 'directory' \| 'symlink' \| 'other'` | ✅ | 条目类型 |
| `size` | `number` | ❌ | 文件大小（目录可省略） |
| `lastModified` | `Date` | ❌ | 最后修改时间 |

### 4.5 选项类型

#### ReadOptions

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `offset` | `number` | ❌ | 字节偏移量（范围读取） |
| `length` | `number` | ❌ | 读取字节数 |
| `encoding` | `BufferEncoding` | ❌ | 文本编码（默认 null/二进制） |

#### ListOptions

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `recursive` | `boolean` | ❌ | 是否递归列出 |
| `maxDepth` | `number` | ❌ | 最大递归深度 |
| `filter` | `(entry: Entry) => boolean` | ❌ | 过滤函数 |

#### DriverConfig

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `credentials` | `Record<string, string>` | ❌ | 凭据映射 |
| `timeout` | `number` | ❌ | 超时时间（毫秒） |
| `retryCount` | `number` | ❌ | 重试次数 |
| `cachePolicy` | `'none' \| 'metadata' \| 'full'` | ❌ | 缓存策略 |
| `customOptions` | `Record<string, unknown>` | ❌ | 自定义选项 |

### 4.6 错误类型层级

| 类 | 继承 | code | 属性 |
|----|------|------|------|
| `AVFSError` | `Error` | — | `code: string`, `cause?: Error` |
| `NotFoundError` | `AVFSError` | `'NOT_FOUND'` | — |
| `PermissionError` | `AVFSError` | `'FORBIDDEN'` | — |
| `TimeoutError` | `AVFSError` | `'TIMEOUT'` | — |
| `ConnectionError` | `AVFSError` | `'CONNECTION_ERROR'` | — |
| `NotImplementedError` | `AVFSError` | `'NOT_IMPLEMENTED'` | — |

---

## 5. 接口设计

> 以下为 AVFSDriver 接口的完整 TypeScript 定义和各驱动的方法契约。

### 5.1 AVFSDriver 接口定义

| 分类 | 成员 | 签名 |
|------|------|------|
| **元数据** | `protocol` | `readonly string` |
| | `version` | `readonly string` |
| | `displayName` | `readonly string` |
| | `description` | `readonly string` |
| **生命周期** | `initialize` | `(config: DriverConfig) => Promise<void>` |
| | `destroy` | `() => Promise<void>` |
| **核心操作** | `connect` | `(address: ParsedAddress) => Promise<Connection>` |
| | `stat` | `(address: ParsedAddress) => Promise<ResourceMetadata>` |
| | `read` | `(address: ParsedAddress, options?: ReadOptions) => Promise<ReadableStream<Uint8Array>>` |
| | `list` (可选) | `(address: ParsedAddress, options?: ListOptions) => Promise<Entry[]>` |
| **可选能力** | `exists` (可选) | `(address: ParsedAddress) => Promise<boolean>` |

> 注：`write?`/`delete?` 在接口中保留定义但 FT-003 不实现（DP2 决策）。

### 5.2 FileDriver 方法契约

| 方法 | 输入 | 输出 | 实现要点 |
|------|------|------|----------|
| `initialize` | `DriverConfig` | `Promise<void>` | no-op，幂等 |
| `destroy` | — | `Promise<void>` | no-op，安全多次调用 |
| `connect` | `ParsedAddress` | `Promise<Connection>` | `path.resolve(resourceBase, filePath)` 拼装路径，返回轻量 Connection |
| `stat` | `ParsedAddress` | `Promise<ResourceMetadata>` | `fs.statSync` + 字段映射；目录额外填充 `extra.isDirectory` |
| `read` | `ParsedAddress, ReadOptions?` | `Promise<ReadableStream<Uint8Array>>` | `fs.createReadStream` + `Readable.toWeb()` 转换 |
| `list` | `ParsedAddress, ListOptions?` | `Promise<Entry[]>` | `fs.readdirSync({withFileTypes:true})` + 映射 + 排序（目录优先） |
| `exists` | `ParsedAddress` | `Promise<boolean>` | `fs.existsSync` |

**元数据**：`protocol='file'`, `version='1.0.0'`, `displayName='Local Filesystem Driver'`, `description='Accesses local files via Node.js fs module (cross-platform)'`

### 5.3 GitDriver 适配后方法契约

| 方法 | 输入 | 输出 | 适配说明 |
|------|------|------|----------|
| `initialize` | `DriverConfig` | `Promise<void>` | no-op |
| `destroy` | — | `Promise<void>` | 重置 owner/repo/version（原 close 逻辑） |
| `connect` | `ParsedAddress` | `Promise<Connection>` | 从 `address.resourceBase` 解析 owner/repo，从 `address.version` 读版本 |
| `stat` | `ParsedAddress` | `Promise<ResourceMetadata>` | GitHub Contents API JSON → ResourceMetadata（补充 name/path/contentType） |
| `read` | `ParsedAddress, ReadOptions?` | `Promise<ReadableStream<Uint8Array>>` | GitHub Contents API raw → response.body |
| `list` | — | — | 不实现（GitHub API 无目录列表语义） |
| `exists` | — | — | 不实现 |

**元数据**：`protocol='git'`, `version='1.0.0'`, `displayName='Git Driver (GitHub API)'`, `description='Accesses GitHub repositories via REST API Contents endpoint'`

### 5.4 桩驱动方法契约（http/https/smb）

| 方法 | 行为 |
|------|------|
| `initialize`/`destroy` | no-op |
| `connect`/`stat`/`read`/`list`/`exists` | 抛出 `NotImplementedError(code='NOT_IMPLEMENTED')` |

**元数据**（各驱动不同）：
- http: `displayName='HTTP Driver'`, `description='Accesses HTTP resources (not yet implemented)'`
- https: `displayName='HTTPS Driver'`, `description='Accesses HTTPS resources (not yet implemented)'`
- smb: `displayName='SMB Driver'`, `description='Accesses SMB shares (not yet implemented)'`

### 5.5 驱动分发框架 API

| 函数 | 签名 | 说明 |
|------|------|------|
| `registerDriver` | `(protocol: string, factory: () => AVFSDriver) => void` | 注册驱动工厂函数 |
| `getDriver` | `(protocol: string) => AVFSDriver` | 按协议获取驱动实例（每次创建新实例） |
| `getSupportedProtocols` | `() => string[]` | 返回已注册的协议列表 |

**预注册映射**：

| 协议 | 工厂函数 |
|------|----------|
| `file` | `() => new FileDriver()` |
| `git` | `() => new GitDriver()` |
| `http` | `() => new HttpDriver()` |
| `https` | `() => new HttpsDriver()` |
| `smb` | `() => new SmbDriver()` |

### 5.6 stat 命令接口

| 方面 | 说明 |
|------|------|
| 命令 | `avfs stat <address>` |
| 参数 | `<address>` — AVFS 地址（必填） |
| 选项 | 无 |
| 输出 | `ResourceMetadata` JSON（成功）/ 错误消息（失败） |
| 退出码 | 0（成功）/ 1（失败） |
| 错误处理 | `NotImplementedError` → "协议 X 的 stat 暂未实现"；`NotFoundError` → "文件不存在"；其他 → 通用错误消息 |

### 5.7 fetch 命令接口

| 方面 | 说明 |
|------|------|
| 命令 | `avfs fetch <address> [-o <file>]` |
| 参数 | `<address>` — AVFS 地址（必填） |
| 选项 | `-o, --output <file>` — 输出到文件（默认 stdout） |
| 输出 | 文件二进制内容到 stdout 或 `-o` 指定文件 |
| 退出码 | 0（成功）/ 1（失败） |
| 支持协议 | file + git（DP6）；http/https/smb 抛 `NotImplementedError` |
| 错误处理 | 同 stat 命令 |

---

## 6. 依赖关系

### 6.1 外部依赖

**无新增外部依赖**。FT-003 仅使用 Node.js 内置模块：

| 模块 | 用途 | 使用方 |
|------|------|--------|
| `node:fs` | 文件系统操作（statSync/createReadStream/readdirSync/existsSync） | FileDriver |
| `node:path` | 路径拼装与解析（resolve/basename） | FileDriver |
| `node:stream` | 流转换（Readable.fromWeb / Readable.toWeb） | FileDriver + fetch 命令 |
| `node:crypto` | 可选 SHA-256 校验和计算 | FileDriver（checksum 字段） |
| `node:stream/promises` | pipeline 管道 | fetch 命令（已有） |

### 6.2 内部依赖

| 依赖项 | 依赖方 | 说明 |
|--------|--------|------|
| `parser/types.ts` (ParsedAddress) | driver.interface.ts, 所有驱动, stat/fetch 命令 | 核心类型，不修改 |
| `drivers/driver.interface.ts` (AVFSDriver) | 所有驱动, registry.ts | FT-003 升级 |
| `drivers/errors.ts` (AVFSError) | 所有驱动 | FT-003 新增 |
| `drivers/mime-utils.ts` (inferMimeType) | FileDriver, GitDriver | FT-003 新增（从 GitDriver 提取） |
| `drivers/registry.ts` (getDriver) | stat.command.ts, fetch.command.ts | FT-003 新增 |
| `parser/uri-parser.ts` (parseAvfsUri) | stat/fetch 命令 | 不修改 |

### 6.3 前序特性依赖

| 特性 | 依赖内容 |
|------|----------|
| FT-001 | CLI 基础框架、驱动桩、命令注册模式 |
| FT-002 | ParsedAddress 类型、GitDriver 生产实现、parseAvfsUri、fetch 流处理模式 |

### 6.4 后续特性影响

| 后续特性 | FT-003 提供的基础 |
|----------|-----------------|
| http/https 驱动实现 | AVFSDriver 接口 + 标准化错误 + 驱动分发框架 |
| smb 驱动实现 | 同上 |
| `avfs list` 命令 | FileDriver.list() 已实现，仅需 CLI 命令入口 |
| `avfs plugin list` 命令 | 驱动元数据字段（version/displayName/description） |
| write/delete 操作 | 接口已预留 write?/delete? 方法签名 |

---

## 7. 风险与缓解

| # | 风险 | 影响 | 概率 | 缓解措施 |
|:-:|------|------|:----:|----------|
| 1 | **ParsedAddress 代码版与 spec 版字段差异** | 驱动接口使用 ParsedAddress 时字段名/可空性不一致 | 🟡 中 | 以代码版为准（parser 已有完整实现和测试），FT-003 完成后更新 spec 对齐 |
| 2 | **Connection 对象对无状态驱动过度设计** | FileDriver/GitDriver 无实际连接状态，Connection 为空壳 | 🟡 中 | 返回轻量 Connection（isOpen 总 true，close 为 no-op），满足接口契约但不增加复杂度 |
| 3 | **Web ReadableStream 与 Node Readable 转换** | FileDriver 使用 fs.createReadStream（Node Readable），需转为 Web ReadableStream | 🟢 低 | 使用 Node.js 20 内置 `Readable.toWeb()` API，已在 fetch 命令中验证 `Readable.fromWeb()` 可行 |
| 4 | **跨平台路径处理** | Windows 路径分隔符 `\` 与 Unix `/` 不同 | 🟢 低 | `path.resolve()` 自动处理跨平台分隔符，`fs` 模块全平台兼容 |
| 5 | **GitDriver 接口签名 breaking change** | connect/stat/read 签名全变，现有测试需重写 | 🟡 中 | 同步更新 `git.driver.test.ts`，mock 策略不变（vi.stubGlobal fetch） |
| 6 | **stat 命令输出格式变更** | 从 ParsedAddress JSON 变为 ResourceMetadata JSON，可能影响下游消费者 | 🟡 中 | FT-002 时 stat 仅输出解析结果无实际消费者；PRD 场景已明确新输出格式 |
| 7 | **ResourceMetadata 可选字段计算开销** | checksum（SHA-256）对大文件耗时 | 🟢 低 | checksum 默认不计算（undefined），仅在显式请求时计算 |
| 8 | **fs.statSync 同步阻塞** | 对大目录或网络文件系统（NFS）可能阻塞事件循环 | 🟢 低 | FT-003 范围为本地文件系统，同步调用可接受；后续可优化为 async 版本 |

---

## 8. 验收条件 (DoD)

> **状态说明**：
> - ✅ 已实现 | 🟡 部分实现 | ❌ 待实现

### 8.1 核心功能

| 编号 | 完成点 | 说明 | 状态 | 完成状态说明 |
| :----: | -------- | ------ | :----: | ---------- |
| 8.1.1 | AVFSDriver 接口定义 | 元数据字段 + 生命周期 + Connection + ParsedAddress 参数 + 可选方法 | ❌ | 待开发 |
| 8.1.2 | AVFSError 错误体系 | 基类 + 5 种子类（NotFound/Permission/Timeout/Connection/NotImplemented） | ❌ | 待开发 |
| 8.1.3 | ResourceMetadata 模型 | 11 字段标准化元数据 | ❌ | 待开发 |
| 8.1.4 | Connection 类型 | 连接对象（id/createdAt/protocol/metadata/close/isOpen） | ❌ | 待开发 |
| 8.1.5 | Entry 类型 + ReadOptions/ListOptions/DriverConfig | 辅助类型定义 | ❌ | 待开发 |
| 8.1.6 | FileDriver 完整实现 | initialize/destroy/connect/stat/read/list/exists | ❌ | 待开发 |
| 8.1.7 | GitDriver 接口适配 | 新签名 + ResourceMetadata + 标准化错误 + 元数据字段 | ❌ | 待开发 |
| 8.1.8 | 桩驱动适配（http/https/smb） | 新接口签名 + NotImplementedError | ❌ | 待开发 |
| 8.1.9 | 驱动分发框架 | registry.ts + registerDriver/getDriver + 预注册 5 协议 | ❌ | 待开发 |
| 8.1.10 | 共享 MIME 工具 | mime-utils.ts（从 GitDriver 提取） | ❌ | 待开发 |

### 8.2 CLI 命令

| 编号 | 完成点 | 说明 | 状态 | 完成状态说明 |
| :----: | -------- | ------ | :----: | ---------- |
| 8.2.1 | stat 命令改造 | 调用 driver.stat() 输出 ResourceMetadata | ❌ | 待开发 |
| 8.2.2 | stat 错误处理 | NotImplementedError 明确提示协议未实现 | ❌ | 待开发 |
| 8.2.3 | fetch 命令改造 | 协议分发框架 + file + git 双协议支持 | ❌ | 待开发 |
| 8.2.4 | fetch 流处理复用 | Web→Node 流转换 + pipeline（复用现有逻辑） | ❌ | 待开发 |
| 8.2.5 | version 传递修正 | 移除 credentials hack，从 ParsedAddress 直接传递 | ❌ | 待开发 |

### 8.3 跨平台

| 编号 | 完成点 | 说明 | 状态 | 完成状态说明 |
| :----: | -------- | ------ | :----: | ---------- |
| 8.3.1 | Linux 文件访问 | file 协议 stat/fetch 在 Linux 上正常工作 | ❌ | 待验证 |
| 8.3.2 | macOS 文件访问 | file 协议 stat/fetch 在 macOS 上正常工作 | ❌ | 待验证 |
| 8.3.3 | Windows 文件访问 | file 协议 stat/fetch 在 Windows 上正常工作（路径分隔符自动处理） | ❌ | 待验证 |
| 8.3.4 | ResourceMetadata 跨平台一致 | 三个平台输出字段结构一致 | ❌ | 待验证 |

### 8.4 错误处理

| 编号 | 完成点 | 说明 | 状态 | 完成状态说明 |
| :----: | -------- | ------ | :----: | ---------- |
| 8.4.1 | FileDriver 错误映射 | ENOENT→NotFoundError, EACCES→PermissionError | ❌ | 待开发 |
| 8.4.2 | GitDriver 错误映射 | 404→NotFoundError, 403→PermissionError, 超时→TimeoutError, 网络失败→ConnectionError | ❌ | 待开发 |
| 8.4.3 | 桩驱动错误 | http/https/smb 抛 NotImplementedError | ❌ | 待开发 |
| 8.4.4 | 错误 code 可编程消费 | Agent 可通过 `error.code` 判断错误类型（非字符串匹配） | ❌ | 待开发 |

### 8.5 测试覆盖

| 编号 | 完成点 | 说明 | 状态 | 完成状态说明 |
| :----: | -------- | ------ | :----: | ---------- |
| 8.5.1 | FileDriver 单元测试 | stat/read/list/exists + 错误场景 | ❌ | 待开发 |
| 8.5.2 | GitDriver 测试更新 | 适配新接口签名 + 标准化错误 | ❌ | 待开发 |
| 8.5.3 | 桩驱动测试更新 | 验证抛出 NotImplementedError | ❌ | 待开发 |
| 8.5.4 | stat 命令测试 | file/git 协议 + 未实现协议错误 | ❌ | 待开发 |
| 8.5.5 | fetch 命令测试更新 | file 协议 + 协议分发逻辑 | ❌ | 待开发 |
| 8.5.6 | 错误类型测试 | 每种错误类型的 code 属性验证 | ❌ | 待开发 |

### 8.6 文档对齐

| 编号 | 完成点 | 说明 | 状态 | 完成状态说明 |
| :----: | -------- | ------ | :----: | ---------- |
| 8.6.1 | driver-interface.md 更新（EN） | ParsedAddress 字段对齐 + file 驱动跨平台描述 + 错误类型实现状态 | ❌ | 待开发 |
| 8.6.2 | driver-interface.md 更新（ZH） | 同上中文版同步 | ❌ | 待开发 |
| 8.6.3 | SKILL.md 检查 | stat 输出示例如有需同步更新 | ❌ | 待检查 |

---

**文档版本**：1.1.0
**创建日期**：2026-06-17
**最后更新**：2026-06-17
**维护者**：AI Agent (qahc-harness)
