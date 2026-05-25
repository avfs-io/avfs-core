# FT-002 Git 地址解析 — PRD 产品需求文档

> **🔗 前置依赖**：本文档基于 [FT-002-git-address-parsing-AskMe.md](./FT-002-git-address-parsing-AskMe.md)（需求访谈文档）编写。

> 最后更新：2026-05-25

---

## 修订记录

| 版本 | 日期 | 修订人 | 修订内容 |
| ------ | ------ | -------- | ---------- |
| 1.0.0 | 2026-05-25 | AI Agent | 初始版本（总体概述 + 使用场景） |

---

## 目录

- [1. 总体概述](#1-总体概述)
- [2. 使用场景](#2-使用场景)
<!-- 阶段二补充：技术方案、数据模型、接口设计、依赖关系、风险与缓解、验收条件 (DoD) -->

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
| 8 | Git Driver 策略 | **A — GitHub API** | 零本地存储，零系统 git 依赖，后续按厂商适配不同 API |
| 9 | fetch 输出 | **B — stdout + `-o` 可选** | Unix 管道友好，与 SKILL.md 定义一致 |
| 10 | convert `--to-native` | **C — JSON 输出** | git 协议无唯一原生格式，JSON 无损保留全部字段 |
| 13 | convert 协议范围 | **A — 全 5 协议** | file/http/https 转换几乎无歧义，smb 路径替换可控，一次性建成 |
| 14 | fetch 非 git 行为 | **A — 明确报错** | 聚焦交付，避免范围蔓延；后续特性实现其余协议 driver |

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
**前置条件**：avfs CLI 已安装

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

<!-- 阶段二补充 -->
## 技术方案

<!-- 阶段二补充 -->

## 数据模型

<!-- 阶段二补充 -->

## 接口设计

<!-- 阶段二补充 -->

## 依赖关系

<!-- 阶段二补充 -->

## 风险与缓解

<!-- 阶段二补充 -->

## 验收条件 (DoD)

<!-- 阶段二补充 -->

---

**文档版本**：1.0.0
**创建日期**：2026-05-25
**最后更新**：2026-05-25
**维护者**：AI Agent (qahc-harness)
