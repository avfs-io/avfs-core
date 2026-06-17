# FT-003 Driver 接口标准化 + File 驱动实现 — PRD 产品需求文档

> **🔗 前置依赖**：本文档基于 [FT-003-driver-interface-and-file-driver-AskMe.md](./FT-003-driver-interface-and-file-driver-AskMe.md)（需求访谈文档）编写。

> 最后更新：2026-06-17

---

## 修订记录

| 版本 | 日期 | 修订人 | 修订内容 |
| ------ | ------ | -------- | ---------- |
| 1.0.0 | 2026-06-17 | AI Agent | 初始版本 |

---

## 目录

- [1. 总体概述](#1-总体概述)
- [2. 使用场景](#2-使用场景)
<!-- 阶段二补充：技术方案、数据模型、接口设计、依赖关系、风险与缓解、验收条件 (DoD) -->

---

## 1. 总体概述

### 1.1 背景与目标

**背景**：FT-002（Git 地址解析）实现完成后，对代码实现与协议规范文档进行了逐项对比分析，发现 Driver 接口层存在显著的代码-文档差异。当前 `cli/src/drivers/driver.interface.ts` 仅定义了简化的 4 方法接口（`connect`/`read`/`stat`/`close`，纯 string 参数、void 返回、普通 Error），而协议规范 `driver-interface.md` 定义了完整的 `AVFSDriver` 接口（含元数据字段、生命周期、Connection 对象、ParsedAddress 参数、9 种标准化错误类型、4 个可选方法）。此外，当前 `avfs stat` 命令仅输出地址解析结果（`ParsedAddress` JSON），未调用底层驱动获取文件元数据。

**目标**：
1. 将 Driver 接口从简化版升级为与文档一致的**完整 AVFSDriver 接口**，为后续 http/https/smb 驱动实现提供统一基线
2. 实现 **file 协议驱动**（本地文件系统）作为首个非 git 的参考实现，验证接口完备性
3. 让 **`avfs stat`** 连接真实驱动输出文件元数据（`ResourceMetadata`），而非仅地址解析
4. 让 **`avfs fetch`** 支持 file 协议，建立统一的协议-驱动分发框架

### 1.2 核心概念

| 概念 | 说明 |
|------|------|
| **AVFSDriver 接口** | 协议规范定义的完整驱动契约，包含元数据字段（protocol/version/displayName/description）、生命周期（initialize/destroy）、核心操作（connect→Connection、stat→ResourceMetadata、read with ParsedAddress+ReadOptions）、可选方法（list/exists/write/delete） |
| **FileDriver** | file 协议（`avfs://file/...`）的参考实现，基于 POSIX `fs` 模块，实现核心 + 可选方法（initialize/destroy/connect/stat/read/list/exists） |
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

### 2.1 场景一：开发者升级新协议驱动

**角色**：开发者实现 http/https/smb 等新协议驱动
**前置条件**：完整 AVFSDriver 接口已定义并发布

**操作步骤**：
1. 开发者参考 `AVFSDriver` 接口定义编写新驱动类
2. 实现 `protocol`/`version`/`displayName`/`description` 元数据字段
3. 实现 `initialize(config)` 和 `destroy()` 生命周期方法
4. 实现核心方法：`connect(ParsedAddress) → Connection`、`stat(ParsedAddress) → ResourceMetadata`、`read(ParsedAddress, options?) → ReadableStream`
5. 按需实现可选方法：`list?()`、`exists?()`
6. 在操作中抛出标准化错误类型（NotFoundError/PermissionError/TimeoutError/ConnectionError/NotImplementedError）
7. 注册到插件注册表，驱动立即可用于 CLI 全部命令

**预期结果**：新驱动遵循统一契约，无需改动 CLI 命令代码即可获得 stat/fetch 支持

---

### 2.2 场景二：用户通过 file 协议获取文件元数据

**角色**：AI Agent 或终端用户
**前置条件**：FileDriver 已实现并注册

**操作步骤**：
1. 用户执行 `avfs stat avfs://file/home/user/config.json`
2. CLI 解析地址获取 ParsedAddress（protocol=file, resourceBase=home, filePath=user/config.json）
3. 插件注册表按 protocol=file 匹配到 FileDriver
4. FileDriver 调用 `fs.statSync('/home/user/config.json')` 获取 POSIX 元数据
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
4. Agent 捕获 `NotImplementedError`，据此判断 htts:// 协议的 stat 暂不可用
5. Agent 向用户反馈："https 协议的元数据查询暂未实现，建议使用 git 或 file 协议"

**预期结果**：Agent 通过标准错误类型代码（而非字符串匹配）做出正确的降级决策

---

<!-- 阶段二补充：技术方案、数据模型、接口设计、依赖关系、风险与缓解、验收条件 (DoD) -->

---

**文档版本**：1.0.0
**创建日期**：2026-06-17
**最后更新**：2026-06-17
**维护者**：AI Agent (qahc-harness)
