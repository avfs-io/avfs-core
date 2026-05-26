# FT-002 Git 地址解析 — PRD 产品需求文档

> **🔗 前置依赖**：本文档基于 [FT-002-git-address-parsing-AskMe.md](./FT-002-git-address-parsing-AskMe.md)（需求访谈文档）编写。

> 最后更新：2026-05-25

---

## 修订记录

| 版本 | 日期 | 修订人 | 修订内容 |
| ------ | ------ | -------- | ---------- |
| 1.0.0 | 2026-05-25 | AI Agent | 初始版本（总体概述 + 使用场景） |
| 1.1.0 | 2026-05-25 | AI Agent | 明确作用域限制：仅 GitHub public repo，Private repo + OAuth/Token 后续支持 |
| 1.2.0 | 2026-05-25 | AI Agent | 新增决策点 16：标准化测试数据框架（`cli/test/fixtures/` JSON fixtures） |
| 2.0.0 | 2026-05-25 | AI Agent | 阶段二详细设计完成：技术方案、数据模型、接口设计、依赖关系、风险与缓解、验收条件 |
| 2.1.0 | 2026-05-25 | AI Agent | 明确覆盖率工具 `@vitest/coverage-v8` + 具体覆盖率阈值（Lines ≥90%, Branches ≥85%, Functions ≥90%, Statements ≥90%） |

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

AVFS 项目已完成 FT-001 CLI 基础框架（help/version + 6 组 Mock 子命令 + CI/CD），但所有命令均为占位实现，`avfs validate`、`avfs stat`、`avfs convert`、`avfs fetch` 均输出 "planned but not yet implemented"。Git Driver 为 stub，所有方法抛出 "Not implemented"。

FT-002 旨在实现 CLI 的首批真实功能，目标如下：

| 目标 | 说明 |
|------|------|
| 全协议地址解析 | 构建通用 AVFS URI 解析器，支持 file/http/https/smb/git 五种协议 |
| 全协议双向转换 | 实现原生路径/URL ↔ `avfs://` 格式的无损映射（`--to-avfs` / `--to-native`） |
| GitHub API Driver | 通过 GitHub REST API 实现 git 协议文件获取（零本地存储，零系统 git 依赖） |
| 全链路 CLI 可用 | validate → stat → convert → fetch 四个命令从 Mock 替换为真实实现 |

> **⚠️ 作用域限制**：本特性仅支持 **GitHub Public Repository（公开仓库）** 的匿名 API 访问，无需认证。**Private Repository（私有仓库）** 及 Token/OAuth 认证机制将在后续特性中支持。

### 1.2 核心概念

| 概念 | 定义 |
|------|------|
| **AVFS URI** | 格式为 `avfs://<proto>/<resource-base>[@<version>]/<file-path>[#anchor]` 的统一资源地址 |
| **ParsedAddress** | 解析后的结构化对象，含 `protocol`、`resourceBase`、`version`、`filePath`、`anchor`、`isValid`、`errors[]`、`rawInput` |
| **协议转换器** | 各协议独立的原生格式 ↔ AVFS URI 双向转换逻辑（file/http/https/smb/git） |
| **Git Platform** | 策略接口，抽象不同 git 平台的 URL 检测与 resourceBase 提取规则（首期实现 `GitHubPlatform`） |
| **Git Driver** | 通过 GitHub API（`GET /repos/{org}/{repo}/contents/{path}?ref={version}`）获取文件内容，实现 Driver 接口（connect/read/stat/close） |

### 1.3 变更范围

| 变更模块 | 变更类型 | 变更描述 |
| ---------- | :--------: | ---------- |
| `cli/src/parser/` | 新增 | 全协议地址解析模块：URI 拆解 + 各协议转换器 + Git 平台检测 |
| `cli/src/drivers/git.driver.ts` | 修改 | 从 stub 替换为 GitHub API Driver |
| `cli/src/commands/validate.command.ts` | 修改 | 从 Mock 替换为全协议地址语法校验 |
| `cli/src/commands/stat.command.ts` | 修改 | 从 Mock 替换为全协议地址解析 + JSON 输出 |
| `cli/src/commands/convert.command.ts` | 修改 | 从 Mock 替换为全 5 协议双向转换 |
| `cli/src/commands/fetch.command.ts` | 修改 | 从 Mock 替换为 Git 协议文件获取（非 git 协议报错） |
| `cli/test/` | 新增 | parser + driver + commands 单元测试与集成测试 |
| `cli/test/fixtures/` | 新增 | 标准化测试数据框架（JSON fixtures），含 addressing/git-conversion/platform-detection 四组数据集 |

### 1.4 关键决策

| # | 决策点 | 决策结论 | 理由摘要 |
| --- | ------ | ---------- | ---------- |
| 1 | 特性范围界定 | **B — 全协议通用解析器** | 一次建成全协议解析器，后续特性只需填充各协议 driver；convert 命令对全部 5 协议生效 |
| 2 | Git 原生 URL 范围 | **B — HTTPS + SSH** | 覆盖 GitHub 唯二官方 clone 方式，裸引用易混淆留后处理 |
| 3 | Git 平台覆盖 | **B — GitHub + 可扩展接口** | 策略模式预留扩展点，后续添 GitLab 等零重构 |
| 4 | CLI 命令 + Driver | **C — 全部激活 + Driver 在 cli 内** | 全链路工作流可运行，延续 FT-001 "先集中后拆分"策略 |
| 5 | 代码模块组织 | **A — `cli/src/parser/`** | 与 FT-001 Driver 策略一致，拆分时零重构 |
| 6 | ParsedAddress 结构 | **B — 带元信息类型** | `isValid`+`errors[]` 优雅处理校验失败，`rawInput` 便于调试 |
| 7 | stat 输出格式 | **B — JSON 默认** | AI Agent 友好，与 docker/kubectl 等主流 CLI 一致 |
| 8 | Git Driver 策略 | **A — GitHub API（仅 Public Repo）** | 零本地存储，零系统 git 依赖；仅匿名访问公开仓库，后续按厂商适配不同 API |
| 15 | 认证与仓库可见性 | **A — 仅 GitHub Public Repo（无认证）** | 首期只支持公开仓库的匿名 API 访问；Private repo + 认证（Token/OAuth）后续支持 |
| 9 | fetch 输出 | **B — stdout + `-o` 可选** | Unix 管道友好，与 SKILL.md 定义一致 |
| 10 | convert `--to-native` | **C — JSON 输出** | git 协议无唯一原生格式，JSON 无损保留全部字段 |
| 13 | convert 协议范围 | **A — 全 5 协议** | file/http/https 转换几乎无歧义，smb 路径替换可控，一次性建成 |
| 14 | fetch 非 git 行为 | **A — 明确报错** | 聚焦交付，避免范围蔓延；后续特性实现其余协议 driver |
| 16 | 测试数据框架 | **A — JSON fixtures in `cli/test/fixtures/`** | 按领域分目录，统一 `{ meta, testCases[] }` 结构；JSON 可直接 import；后续特性增量追加 |
| 17 | 覆盖率工具 | **A — `@vitest/coverage-v8`（内置 V8 provider）** | Vitest 原生推荐，无需额外配置引擎；比 istanbul 更快，TypeScript sourcemap 原生支持 |

---

## 2. 使用场景

### 2.1 场景一：校验 AVFS 地址语法

**角色**：AI Agent / 开发者
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs validate avfs://git/github.com/avfs-io/core@main/readme.md`
2. 系统解析 URI 各字段，逐项校验
3. 输出校验结果

**预期结果**：输出 JSON 表示校验通过：
```text
{"valid":true,"protocol":"git","resourceBase":"github.com/avfs-io/core","version":"main","filePath":"readme.md"}
```

---

### 2.2 场景二：校验非法地址并给出错误原因

**角色**：AI Agent / 开发者
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs validate "not-an-avfs-address"`
2. 系统检测到不以 `avfs://` 开头
3. 输出校验失败及错误原因

**预期结果**：输出 JSON 含 `valid:false` 和具体错误：
```text
{"valid":false,"errors":["Address must start with 'avfs://'"],"rawInput":"not-an-avfs-address"}
```

---

### 2.3 场景三：解析 Git 地址并展示结构化字段

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs stat avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh`
2. 系统解析 URI 并返回结构化信息

**预期结果**：输出 JSON：
```text
{"protocol":"git","resourceBase":"github.com/avfs-io/core","version":"v1.0.0","filePath":"script/build.sh","anchor":null,"rawInput":"avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh"}
```

---

### 2.4 场景四：解析带锚点的地址

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs stat avfs://file/log/app.log#L120`
2. 系统解析 URI 并提取锚点

**预期结果**：输出 JSON 含 `anchor:"L120"`：
```text
{"protocol":"file","resourceBase":"log","filePath":"app.log","anchor":"L120",...}
```

---

### 2.5 场景五：原生 HTTPS Git URL 转 AVFS

**角色**：开发者
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert https://github.com/avfs-io/core.git --to-avfs`
2. 系统识别为 GitHub HTTPS clone URL
3. 输出 AVFS 格式地址

**预期结果**：输出 `avfs://git/github.com/avfs-io/core`（resourceBase 不含 `.git` 后缀）

---

### 2.6 场景六：SSH Git URL 转 AVFS

**角色**：开发者
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert git@github.com:avfs-io/core.git --to-avfs`
2. 系统识别为 GitHub SSH URL（`git@` 前缀 + `:` 分隔符）
3. 转换并输出

**预期结果**：输出 `avfs://git/github.com/avfs-io/core`

---

### 2.7 场景七：AVFS Git 地址转原生格式

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert avfs://git/github.com/avfs-io/core@v1.0.0/path/file.ts --to-native`
2. 系统解析 AVFS URI 并重建原生引用

**预期结果**：输出 JSON：
```text
{"cloneUrl":"https://github.com/avfs-io/core.git","version":"v1.0.0","filePath":"path/file.ts"}
```

---

### 2.8 场景八：本地文件路径转 AVFS

**角色**：开发者
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert /home/user/config.json --to-avfs`
2. 系统识别为本地路径
3. 输出 AVFS 格式

**预期结果**：输出 `avfs://file/home/user/config.json`

---

### 2.9 场景九：HTTP URL 转 AVFS

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert http://192.168.1.100:8080/api/data.csv --to-avfs`
2. 系统识别 HTTP 协议
3. 输出 AVFS 格式

**预期结果**：输出 `avfs://http/192.168.1.100:8080/api/data.csv`

---

### 2.10 场景十：HTTPS URL 转 AVFS

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert https://cdn.example.com/files/v1/package.zip --to-avfs`
2. 系统识别 HTTPS 协议

**预期结果**：输出 `avfs://https/cdn.example.com/files/v1/package.zip`

---

### 2.11 场景十一：SMB UNC 路径转 AVFS

**角色**：开发者
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs convert "\\\\192.168.1.60\\share\\docs\\report.xlsx" --to-avfs`
2. 系统识别 SMB UNC 路径，分隔符统一为 `/`

**预期结果**：输出 `avfs://smb/192.168.1.60/share/docs/report.xlsx`

---

### 2.12 场景十二：通过 GitHub API 获取文件内容到 stdout

**角色**：AI Agent / 开发者
**前置条件**：avfs CLI 已安装，目标仓库为公开仓库

**操作步骤**：
1. 输入 `avfs fetch avfs://git/github.com/avfs-io/core@main/README.md`
2. 系统通过 GitHub API 获取文件内容，默认输出到 stdout

**预期结果**：stdout 输出 README.md 的原始文本内容（管道友好，可 `| jq` 或 `| cat`）

---

### 2.13 场景十三：获取 Git 文件并保存到本地

**角色**：开发者
**前置条件**：avfs CLI 已安装，目标仓库为公开仓库

**操作步骤**：
1. 输入 `avfs fetch avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh -o ./build.sh`
2. 系统通过 GitHub API 获取文件，写入本地文件

**预期结果**：本地生成 `./build.sh`，内容与 Git 仓库中一致

---

### 2.14 场景十四：fetch 非 git 协议时明确报错

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 输入 `avfs fetch avfs://file/home/user/config.json`
2. 系统检测到协议为 file，对应的 driver 尚未实现

**预期结果**：退出码 1，输出错误信息：
```text
Error: avfs fetch for protocol 'file' is not yet implemented.
```

---

### 2.15 场景十五：stat 全协议兼容

**角色**：AI Agent
**前置条件**：avfs CLI 已安装

**操作步骤**：
1. 分别对五种协议地址执行 `avfs stat`：
   - `avfs stat avfs://file/home/user/config.json`
   - `avfs stat avfs://http/192.168.1.100:8080/api/data.csv`
   - `avfs stat avfs://https/cdn.example.com/files/pkg.zip`
   - `avfs stat avfs://smb/192.168.1.60/share/report.xlsx`
   - `avfs stat avfs://git/github.com/avfs-io/core@main/readme.md`

**预期结果**：全部正确解析并输出对应 JSON，字段格式一致

---

## 3. 技术方案

### 3.1 模块结构

```
cli/src/
├── parser/                                    # 新增：全协议地址解析模块
│   ├── index.ts                               #   Public API：parse / convert / validate
│   ├── types.ts                               #   类型定义（ParsedAddress, ProtocolType 等）
│   ├── uri-parser.ts                          #   核心 URI 解析器（avfs://proto/base@ver/path#anchor）
│   ├── validator.ts                           #   语法校验器（校验规则 + 错误信息生成）
│   ├── protocol-converters/                   #   协议转换器（策略模式）
│   │   ├── converter.interface.ts             #     ProtocolConverter 接口
│   │   ├── file-converter.ts                  #     file 协议：path ↔ avfs://file/...
│   │   ├── http-converter.ts                  #     http 协议：URL ↔ avfs://http/...
│   │   ├── https-converter.ts                 #     https 协议：URL ↔ avfs://https/...
│   │   ├── smb-converter.ts                   #     smb 协议：UNC path ↔ avfs://smb/...
│   │   └── git-converter.ts                   #     git 协议：原生 URL ↔ avfs://git/...
│   └── git/                                   #   Git 平台子模块（策略模式）
│       ├── git-platform.interface.ts          #     GitPlatform 接口
│       ├── github-platform.ts                 #     GitHub 平台实现
│       └── platform-registry.ts               #     平台注册表（hostname → GitPlatform）
├── drivers/
│   ├── driver.interface.ts                    # 不变：Driver 接口
│   ├── git.driver.ts                          # 修改：从 stub 替换为 GitHub API Driver
│   ├── file.driver.ts                         # 不变：仍为 stub
│   ├── http.driver.ts                         # 不变：仍为 stub
│   ├── https.driver.ts                        # 不变：仍为 stub
│   └── smb.driver.ts                          # 不变：仍为 stub
└── commands/
    ├── validate.command.ts                    # 修改：调用 parser/validator
    ├── stat.command.ts                        # 修改：调用 parser → JSON 输出
    ├── convert.command.ts                     # 修改：调用各协议 converter
    └── fetch.command.ts                       # 修改：调用 GitDriver
```

### 3.2 处理流程

#### 3.2.1 validate 流程

```
avfs validate <address>
  │
  ├─ parseAvfsUri(address)
  │    ├─ 检查 "avfs://" 前缀
  │    ├─ 提取 protocol（file|http|https|smb|git）
  │    ├─ 提取 resourceBase（协议相关解析）
  │    ├─ 提取 version（git 协议 solo）
  │    ├─ 提取 filePath（必须存在）
  │    └─ 提取 anchor（可选，# 之后）
  │
  ├─ validateAvfsUri(parsed)
  │    ├─ 校验 protocol 是否在 SUPPORTED_PROTOCOLS 中
  │    ├─ 校验 resourceBase 非空且格式正确
  │    ├─ 校验 filePath 非空
  │    ├─ 校验 version 格式（若存在）
  │    └─ 收集 errors[]
  │
  └─ 输出 { valid: boolean, protocol, resourceBase, version?, filePath, anchor?, errors[] }
```

#### 3.2.2 stat 流程

```
avfs stat <address>
  │
  ├─ parseAvfsUri(address)        → ParsedAddress
  │
  └─ JSON.stringify(result)       → stdout
     含 protocol, resourceBase, version, filePath, anchor, rawInput, isValid
```

#### 3.2.3 convert 流程

##### --to-avfs（原生 → AVFS）

```
avfs convert <native-input> --to-avfs
  │
  ├─ detectNativeFormat(nativeInput)
  │    ├─ 匹配 file   → 本地路径（绝对路径或相对路径）
  │    ├─ 匹配 http   → URL 以 http:// 开头
  │    ├─ 匹配 https  → URL 以 https:// 开头且非 git 仓库
  │    ├─ 匹配 smb    → UNC 路径（\\ 或 //）
  │    └─ 匹配 git    → HTTPS clone URL（github.com/.../*.git）
  │                   → SSH URL（git@github.com:...）
  │
  ├─ selectConverter(protocol)
  │
  ├─ converter.toAvfs(nativeInput) → ParsedAddress
  │
  └─ formatAvfsUri(parsed) → "avfs://<proto>/<resourceBase>[@<version>]/<filePath>[#anchor]"
```

##### --to-native（AVFS → 原生）

```
avfs convert <avfs-uri> --to-native
  │
  ├─ parseAvfsUri(avfsUri)        → ParsedAddress
  │
  ├─ selectConverter(parsed.protocol)
  │
  ├─ converter.toNative(parsed)   → NativeUrl (JSON for git, path/URL for others)
  │
  └─ JSON.stringify(result)       → stdout
```

#### 3.2.4 fetch 流程

```
avfs fetch <avfs-uri> [-o <output-file>]
  │
  ├─ parseAvfsUri(avfsUri)        → ParsedAddress
  │
  ├─ if protocol ≠ "git" → 报错并退出（exit 1）
  │
  ├─ gitDriver.connect(resourceBase)
  │    └─ 无需操作（GitHub API 无状态，connect 为 no-op）
  │
  ├─ gitDriver.read(filePath + version)
  │    ├─ 构造 API URL：
  │    │   GET https://api.github.com/repos/{org}/{repo}/contents/{path}?ref={version}
  │    │   Headers: Accept: application/vnd.github.v3.raw
  │    │   （无认证，Public Repo 匿名访问）
  │    ├─ 发送 HTTP 请求（Node.js 内置 fetch）
  │    └─ 返回 ReadableStream<Uint8Array>
  │
  ├─ if -o <file> → 流写入文件
  ├─ else         → 流输出到 process.stdout
  │
  └─ gitDriver.close()
```

### 3.3 核心算法

#### 3.3.1 AVFS URI 解析算法

```
输入： raw (string)
输出： ParsedAddress

1. 前缀检查
   IF NOT raw.startsWith("avfs://") THEN
      RETURN { isValid: false, errors: ["Address must start with 'avfs://'"] }

2. 主体提取
   body = raw.slice("avfs://".length)
   IF body.length === 0 THEN
      RETURN { isValid: false, errors: ["Address is empty after prefix"] }

3. 锚点拆分
   hashIdx = body.indexOf("#")
   IF hashIdx >= 0 THEN
      anchor = body.slice(hashIdx + 1)
      body   = body.slice(0, hashIdx)
   ELSE
      anchor = null

4. 协议提取
   slashIdx = body.indexOf("/")
   IF slashIdx < 0 THEN
      RETURN { isValid: false, errors: ["Missing protocol or resource base"] }
   protocol = body.slice(0, slashIdx).toLowerCase()
   IF protocol NOT IN SUPPORTED_PROTOCOLS THEN
      RETURN { isValid: false, errors: ["Unsupported protocol: '<protocol>'"] }
   remaining = body.slice(slashIdx + 1)

5. 资源基 + 版本 + 文件路径拆分
   version = null
   filePath = null
   resourceBase = ""

   // git 协议：支持 @version 语法
   IF protocol === "git" THEN
      atIdx = remaining.indexOf("@")
      IF atIdx >= 0 THEN
         resourceBase = remaining.slice(0, atIdx)
         afterAt = remaining.slice(atIdx + 1)
         pathSlashIdx = afterAt.indexOf("/")
         IF pathSlashIdx >= 0 THEN
            version    = afterAt.slice(0, pathSlashIdx)
            filePath   = afterAt.slice(pathSlashIdx + 1)
         ELSE
            version    = afterAt
            filePath   = null   // 版本存在但无文件路径 → 校验时标记错误
      ELSE
         // 无 @version：整体为 resourceBase/filePath
         baseSlashIdx = remaining.indexOf("/")
         IF baseSlashIdx >= 0 THEN
            resourceBase = remaining.slice(0, baseSlashIdx)
            filePath     = remaining.slice(baseSlashIdx + 1)
         ELSE
            resourceBase = remaining
            filePath     = null
   ELSE
      // 非 git 协议：无 version 概念，整体为 resourceBase/filePath
      baseSlashIdx = remaining.indexOf("/")
      IF baseSlashIdx >= 0 THEN
         resourceBase = remaining.slice(0, baseSlashIdx)
         filePath     = remaining.slice(baseSlashIdx + 1)
      ELSE
         resourceBase = remaining
         filePath     = null

6. 校验
   errors = []
   IF NOT resourceBase THEN errors.push("Missing resource base")
   IF NOT filePath     THEN errors.push("File path is required")
   IF protocol === "git" AND version AND NOT filePath THEN
      errors.push("File path is required when version is specified")

   RETURN {
      protocol,
      resourceBase,
      version,
      filePath,
      anchor,
      rawInput: raw,
      isValid: errors.length === 0,
      errors
   }
```

#### 3.3.2 Git 原生 URL 识别算法

```
输入： nativeInput (string)
输出： { protocol: "git", platform: "github"|"unknown", resourceBase: string }
      | null (非 git 地址)

1. HTTPS Clone URL 检测
   PATTERN: /^https:\/\/github\.com\/([^\/]+\/[^\/]+?)(?:\.git)?(\/.*)?$/
   匹配示例：
     https://github.com/avfs-io/core.git            → resourceBase="github.com/avfs-io/core"
     https://github.com/avfs-io/core                → resourceBase="github.com/avfs-io/core"
     https://github.com/avfs-io/core/path/file.ts   → resourceBase="github.com/avfs-io/core"

2. SSH URL 检测
   PATTERN: /^git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?(\/.*)?$/
   匹配示例：
     git@github.com:avfs-io/core.git  → resourceBase="github.com/avfs-io/core"
     git@github.com:avfs-io/core      → resourceBase="github.com/avfs-io/core"

3. 平台检测
   GitHub: hostname === "github.com"
   其他：  platform = "unknown"（后续特性扩展 GitLab 等平台注册）
```

#### 3.3.3 协议原生格式检测算法（convert --to-avfs）

```
输入： nativeInput (string)
输出： DetectedProtocol { protocol: ProtocolType, nativeInput: string }

优先级（从高到低）：
1. Git SSH URL       → /^git@github\.com:.+/
2. Git HTTPS URL     → /^https:\/\/github\.com\/[^\/]+\/[^\/]+/
3. SMB UNC path      → /^\\\\[^\s\\]+\\[^\s\\]+/  或  /^\/\/[^\s\/]+\/[^\s\/]+/
4. File path         → /^[\/~]/  或  /^[A-Za-z]:\\/
5. HTTPS URL         → /^https:\/\//
6. HTTP URL          → /^http:\/\//
7. Fallback          → 报错 "Unable to detect protocol for: <input>"
```

---

## 4. 数据模型

### 4.1 核心类型

```typescript
// === parser/types.ts ===

/** 支持的协议类型 */
export const SUPPORTED_PROTOCOLS = ['file', 'http', 'https', 'smb', 'git'] as const;
export type ProtocolType = (typeof SUPPORTED_PROTOCOLS)[number];

/** Git 平台标识 */
export const SUPPORTED_GIT_PLATFORMS = ['github'] as const;
export type GitPlatformType = (typeof SUPPORTED_GIT_PLATFORMS)[number] | 'unknown';

/** AVFS URI 解析结果 */
export interface ParsedAddress {
  /** 协议类型 */
  protocol: ProtocolType | string;
  /** 资源基址（如 github.com/avfs-io/core、/home/user） */
  resourceBase: string;
  /** 版本/分支/Tag（git 协议专属，其他协议为 null） */
  version: string | null;
  /** 文件相对路径 */
  filePath: string | null;
  /** 锚点片段（# 之后的部分，可选） */
  anchor: string | null;
  /** 原始输入地址 */
  rawInput: string;
  /** 是否通过校验 */
  isValid: boolean;
  /** 校验错误列表（isValid=false 时非空） */
  errors: string[];
}

/** 原生地址格式（用于 convert --to-native 输出） */
export interface NativeUrl {
  /** 原生 URL 或路径 */
  url: string;
  /** 协议类型 */
  protocol: ProtocolType;
  /** 元信息（仅 git 协议输出） */
  metadata?: Record<string, string | null>;
}

/** 转换选项 */
export interface ConvertOptions {
  /** 转换方向 */
  direction: 'to-avfs' | 'to-native';
  /** 显式指定协议（用于解决歧义，如裸引用） */
  protocol?: ProtocolType;
}

/** 转换结果 */
export interface ConvertResult {
  /** 输入值 */
  input: string;
  /** 输出值 */
  output: string;
  /** 转换方向 */
  direction: ConvertOptions['direction'];
  /** 协议类型 */
  protocol: ProtocolType;
  /** 是否为 JSON 输出（git to-native 场景） */
  isJson: boolean;
}

/** 合法性校验结果 */
export interface ValidationResult {
  /** 是否合法 */
  valid: boolean;
  /** 解析后的地址（仅 valid=true 时有意义） */
  address?: ParsedAddress;
  /** 错误信息（仅 valid=false 时有意义） */
  errors?: string[];
}

// === parser/git/git-platform.interface.ts ===

/** Git 平台策略接口 */
export interface GitPlatform {
  /** 平台标识 */
  readonly name: GitPlatformType;
  /** 检测输入是否为该平台的 Git URL */
  detect(nativeUrl: string): boolean;
  /** 从原生 URL 提取 resourceBase */
  extractResourceBase(nativeUrl: string): string;
  /** 从 resourceBase 重建 HTTPS clone URL */
  buildCloneUrl(resourceBase: string): string;
}

// === parser/protocol-converters/converter.interface.ts ===

/** 协议转换器接口 */
export interface ProtocolConverter {
  /** 协议类型 */
  readonly protocol: ProtocolType;
  /** 检测输入是否属于该协议 */
  detect(nativeInput: string): boolean;
  /** 原生格式 → ParsedAddress */
  toAvfs(nativeInput: string): ParsedAddress;
  /** ParsedAddress → 原生格式 */
  toNative(parsed: ParsedAddress): NativeUrl;
}
```

### 4.2 数据流转图

```
用户输入 (string)
     │
     ├──[validate/stat]──▶ parseAvfsUri() ──▶ ParsedAddress ──▶ JSON output
     │
     ├──[convert --to-avfs]──▶ detectNativeFormat() ──▶ ProtocolConverter.toAvfs() ──▶ formatAvfsUri()
     │
     ├──[convert --to-native]──▶ parseAvfsUri() ──▶ ProtocolConverter.toNative() ──▶ JSON/path output
     │
     └──[fetch git]──▶ parseAvfsUri() ──▶ GitDriver.read() ──▶ ReadableStream ──▶ stdout | file
```

---

## 5. 接口设计

### 5.1 Public API（`parser/index.ts`）

```typescript
/**
 * 解析 AVFS URI 为结构化对象。
 * 始终返回 ParsedAddress（不抛异常），通过 isValid 判断成功/失败。
 */
export function parseAvfsUri(raw: string): ParsedAddress;

/**
 * 校验 AVFS URI 合法性。
 * @returns 简化校验结果，可单独用于 validate 命令。
 */
export function validateAvfsUri(raw: string): ValidationResult;

/**
 * 将原生路径/URL 转换为 AVFS URI 格式。
 * 自动检测协议类型。
 */
export function convertToAvfs(nativeInput: string): string;

/**
 * 将 AVFS URI 转换为原生路径/URL/JSON 格式。
 * git 协议输出 JSON，其他协议输出文本。
 */
export function convertToNative(avfsUri: string): string;
```

### 5.2 协议转换器接口

```typescript
// parser/protocol-converters/converter.interface.ts
export function getConverter(protocol: ProtocolType): ProtocolConverter;
export function detectProtocol(nativeInput: string): ProtocolType | null;
```

### 5.3 CLI 命令接口变更

#### validate.command.ts

```typescript
// 变更前（stub）
.action(() => { console.log('⚠️ planned but not yet implemented'); });

// 变更后
.action((address: string) => {
  const result = validateAvfsUri(address);
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 1;
});
```

#### stat.command.ts

```typescript
// 变更后
.action((address: string) => {
  const parsed = parseAvfsUri(address);
  console.log(JSON.stringify(parsed));
  if (!parsed.isValid) process.exitCode = 1;
});
```

#### convert.command.ts

```typescript
// 变更后（新增 --to-avfs / --to-native 互斥选项）
.argument('<path>', 'Path or AVFS address to convert')
.option('--to-avfs', 'Convert native path/URL to AVFS address')
.option('--to-native', 'Convert AVFS address to native format')
.action((path: string, options: { toAvfs?: boolean; toNative?: boolean }) => {
  if (options.toAvfs && options.toNative) {
    console.error('Error: --to-avfs and --to-native are mutually exclusive');
    process.exit(1);
  }
  const direction = options.toNative ? 'to-native' : 'to-avfs';
  const output = direction === 'to-avfs'
    ? convertToAvfs(path)
    : convertToNative(path);
  console.log(output);
});
```

#### fetch.command.ts

```typescript
// 变更后（新增 -o 选项）
.argument('<address>', 'AVFS address to fetch')
.option('-o, --output <file>', 'Write output to file instead of stdout')
.action(async (address: string, options: { output?: string }) => {
  const parsed = parseAvfsUri(address);
  if (!parsed.isValid || parsed.protocol !== 'git') {
    console.error(`Error: avfs fetch for protocol '${parsed.protocol}' is not yet implemented.`);
    process.exit(1);
  }
  const driver = new GitDriver();
  const stream = await driver.read(parsed.filePath!);
  if (options.output) {
    // stream → file
  } else {
    // stream → process.stdout
  }
  await driver.close();
});
```

### 5.4 GitDriver 接口实现

```typescript
export class GitDriver implements Driver {
  readonly protocol = 'git';

  private resourceBase: string = '';
  private version: string | null = null;

  /**
   * connect() — 无状态 API，记录 resourceBase 和 version 即可。
   * @param resourceBase 格式: "github.com/{owner}/{repo}"
   */
  async connect(resourceBase: string, _options?: ConnectOptions): Promise<void> {
    this.resourceBase = resourceBase;
    this.version = _options?.credentials?.['version'] ?? null;
  }

  /**
   * read() 通过 GitHub REST API 获取文件原始内容。
   * @param filePath 文件相对路径
   * @returns ReadableStream<Uint8Array>
   *
   * API: GET /repos/{owner}/{repo}/contents/{path}?ref={ref}
   * Headers: Accept: application/vnd.github.v3.raw
   *
   * 错误处理：
   *   - 404 → "File not found: {path} in {owner}/{repo}"
   *   - 403 rate limit → "GitHub API rate limit exceeded. Try again later."
   *   - network → "Network error: {message}"
   */
  async read(filePath: string): Promise<ReadableStream<Uint8Array>>;

  /**
   * stat() 通过 GitHub API HEAD 请求获取文件元数据。
   * @returns FileMetadata { size, mimeType, modifiedAt, protocol }
   */
  async stat(filePath: string): Promise<FileMetadata>;

  /** close() — 无状态 API，重置内部状态即可。 */
  async close(): Promise<void>;
}
```

---

## 6. 依赖关系

### 6.1 外部依赖

| 依赖 | 版本 | 用途 | 变更 |
|------|------|------|:----:|
| `commander` | `^14.0.0` | CLI 框架（参数解析、选项定义） | 已有 |
| Node.js `fetch` | 内置 (≥18) | GitHub API HTTP 请求 | 零新增 |
| Node.js `fs` | 内置 | `-o` 文件写入 + 流管道 | 零新增 |
| Node.js `stream` | 内置 | ReadableStream → WritableStream | 零新增 |

**核心决策：运行时零新增外部依赖。** GitHub API 通过 Node.js 内置 `fetch()`（≥18 可用，项目要求 ≥20）调用，无需 `axios`、`node-fetch` 等第三方库。

**Dev 依赖（新增，测试与覆盖率）**：

| 依赖 | 版本 | 用途 | 变更 |
|------|------|------|:----:|
| `vitest` | `^3.2.4` | 测试框架 | 已有 |
| `@vitest/coverage-v8` | `^3.2.4` | 代码覆盖率工具（Vitest 内置 V8 provider） | 新增 |

安装命令：`pnpm add -D @vitest/coverage-v8`

### 6.2 内部依赖

```
cli/src/index.ts
  └── cli/src/commands/index.ts
        ├── validate.command.ts ──── cli/src/parser/index.ts (parseAvfsUri, validateAvfsUri)
        ├── stat.command.ts ─────── cli/src/parser/index.ts (parseAvfsUri)
        ├── convert.command.ts ──── cli/src/parser/index.ts (convertToAvfs, convertToNative)
        └── fetch.command.ts ────── cli/src/parser/index.ts (parseAvfsUri)
                                 └── cli/src/drivers/git.driver.ts

cli/src/parser/index.ts
  ├── uri-parser.ts
  ├── validator.ts
  ├── types.ts
  └── protocol-converters/
        ├── file-converter.ts
        ├── http-converter.ts
        ├── https-converter.ts
        ├── smb-converter.ts
        └── git-converter.ts ──── git/
                                   ├── github-platform.ts
                                   └── platform-registry.ts
```

### 6.3 依赖方向

```
commands → parser → protocol-converters → git/platforms
commands → drivers/git.driver
```

所有依赖单向流动，`drivers/` 不依赖 `parser/`，`parser/` 不依赖 `commands/`。

---

## 7. 风险与缓解

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|:----:|:----:|----------|
| R1 | GitHub API 匿名访问 rate limit（60 req/h），频繁 fetch 可能触发 403 | 中 | 中 | (1) 文档明确告知限制；(2) stat/validate/convert 不调用 API，不受影响；(3) 后续认证特性消除此限制 |
| R2 | GitHub API 网络不可达（防火墙/离线环境）导致 fetch 失败 | 低 | 高 | `read()` 中明确网络错误信息："Network error: unable to reach api.github.com"；设置 30s 超时 |
| R3 | GitHub API 返回 404（文件不存在 / 仓库不存在） | 中 | 低 | 明确错误信息区分"仓库不存在"和"文件不存在" |
| R4 | SMB UNC 路径转义问题：`\\\\` 在 Shell 中易被转义为 `\\` | 中 | 低 | 文档建议使用单引号包裹：`avfs convert '\\192.168.1.60\share\...'`，或在 convert 命令中接受 Unix 风格路径 `//192.168.1.60/share/...` |
| R5 | 裸引用 `github.com/org/repo` 无法自动判别是 git 还是 http | 低 | 低 | convert 命令：HTTPS URL 中 github.com 裸引用归为 git 协议；resolve 歧义通过后续 `--protocol` 参数解决 |
| R6 | `--to-avfs` 和 `--to-native` 同时指定导致行为冲突 | 低 | 低 | 命令层互斥检查，同时指定时输出明确错误并 exit(1) |
| R7 | 超大文件通过 fetch stdout 输出可能导致终端挂起 | 低 | 低 | 与 curl/wget 行为一致，由用户自行负责；`-o` 写文件可规避 |

---

## 8. 验收条件 (DoD)

### 8.1 命令级验收

#### validate

- [ ] `avfs validate avfs://git/github.com/org/repo@main/file.ts` → `{"valid":true,...}`
- [ ] `avfs validate "not-avfs-address"` → `{"valid":false,"errors":[...]}`
- [ ] 5 种协议各至少 2 个合法 URL 校验通过
- [ ] 至少 5 种非法 URL（无前缀、空协议、缺 resourceBase 等）校验失败并给出明确错误

#### stat

- [ ] `avfs stat avfs://git/...` 输出完整 JSON（protocol, resourceBase, version, filePath, anchor, rawInput）
- [ ] `avfs stat avfs://file/...` 正确解析 filePath 与 anchor
- [ ] `avfs stat avfs://http/...` 正确解析带端口的 resourceBase
- [ ] 5 协议各 1 个用例全部通过

#### convert

- [ ] `--to-avfs`：5 协议各至少 1 个原生输入正确转换
- [ ] `--to-avfs`：Git HTTPS clone URL（含/不含 `.git`）→ `avfs://git/github.com/...`
- [ ] `--to-avfs`：Git SSH URL → `avfs://git/github.com/...`
- [ ] `--to-native`：git 协议 → JSON `{cloneUrl, version, filePath}`
- [ ] `--to-native`：file/http/https/smb → 对应原生路径/URL 文本
- [ ] `--to-avfs` 和 `--to-native` 同时指定 → 报错

#### fetch

- [ ] `avfs fetch avfs://git/github.com/{public-repo}@main/{file}` → stdout 输出文件内容
- [ ] `avfs fetch avfs://git/github.com/{public-repo}@main/{file} -o /tmp/out` → 文件写入成功，内容一致
- [ ] `avfs fetch avfs://file/...` → 明确报错并 exit(1)
- [ ] GitHub API 404 → 友好错误提示
- [ ] 网络不可达 → 友好超时错误提示

### 8.2 模块级验收

#### parser/uri-parser.ts

- [ ] 正确解析含 version 的 git URI
- [ ] 正确解析不含 version 的 git URI（version=null）
- [ ] 正确解析含 anchor 的 URI
- [ ] 正确提取各协议 resourceBase
- [ ] invalid URI 返回 `isValid=false` + `errors[]`，不抛异常

#### parser/protocol-converters/

- [ ] 5 个 converter 全部实现 `ProtocolConverter` 接口
- [ ] file converter：支持 Unix 绝对路径、相对路径
- [ ] http/https converter：支持 IP + 端口、域名、子路径
- [ ] smb converter：支持 UNC `\\server\share\...` → `avfs://smb/...` 双向
- [ ] git converter：正确识别 GitHub HTTPS + SSH，`--to-native` 输出 JSON

#### parser/git/

- [ ] `GitHubPlatform.detect()` 正确识别 GitHub 域名
- [ ] `GitHubPlatform.extractResourceBase()` 去除 `.git` 后缀
- [ ] `PlatformRegistry` 支持注册/查询平台

### 8.3 质量验收

#### 覆盖率工具与配置

- [ ] **工具**：使用 `@vitest/coverage-v8`（Vitest 内置 V8 provider）
- [ ] **安装**：`pnpm add -D @vitest/coverage-v8` 已执行
- [ ] **NPM Script**：`package.json` 已添加 `"test:coverage": "vitest run --coverage"`
- [ ] **Vitest 配置**：`vitest.config.ts`（或 `vitest` 字段在 `package.json`）中配置 coverage provider 为 `v8`，include 覆盖 `src/parser/**` 和 `src/drivers/git.driver.ts`

#### 覆盖率阈值

| 维度 | 阈值 | 范围 |
|:-----|:----:|------|
| **Lines** | ≥ 90% | `src/parser/**/*.ts` + `src/drivers/git.driver.ts` |
| **Branches** | ≥ 85% | 同上（覆盖所有条件分支：if/else、switch、可选链等） |
| **Functions** | ≥ 90% | 同上（所有导出的 Public API + 内部辅助函数） |
| **Statements** | ≥ 90% | 同上 |

> **阈值说明**：Branches 设置为 85% 而非 90%，因为解析器包含大量防御性分支（如多种非法 URI 格式的错误路径），其中部分极端组合可能在实际使用中不可达但被认为需保留——允许 15% 的合理余量。

#### 测试完整性

- [ ] **测试数据**：4 组 JSON fixtures（valid-uris / invalid-uris / git-conversion / platform-detection）已创建
- [ ] **单元测试**：`parser/*.test.ts` + `drivers/git.driver.test.ts` 覆盖全部 testCases
- [ ] **覆盖率报告**：`pnpm test:coverage` 输出覆盖率达到上述阈值
- [ ] **CI 通过**：`pnpm test:coverage` 在 GitHub Actions 中全部通过且覆盖率达标
- [ ] **零新增运行时依赖**：`pnpm ls --prod` 不引入 `commander` 以外的新包
- [ ] **Node ≥20**：代码不使用 ≥21 的新 API
- [ ] **TypeScript strict**：`tsc --noEmit` 零错误

---

**文档版本**：2.1.0
**创建日期**：2026-05-25
**最后更新**：2026-05-25（覆盖率工具与阈值规格明确）
**维护者**：AI Agent (qahc-harness)
**维护者**：AI Agent (qahc-harness)
