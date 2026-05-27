# AVFS 规范 v1.0

**智能体虚拟文件系统通用寻址协议**

| 字段 | 值 |
|------|-----|
| 官方网站 | https://avfs.io |
| 上级项目 | ASDM https://asdm.ai |
| GitHub | https://github.com/avfs-io |
| 许可证 | Apache License 2.0 |

---

## 目录

1. [简介](#1-简介)
   - 1.1 [概述](#11-概述)
   - 1.2 [核心设计目标](#12-核心设计目标)
   - 1.3 [适用范围](#13-适用范围)
2. [核心架构](#2-核心架构)
   - 2.1 [协议-驱动插件机制](#21-协议-驱动插件机制)
   - 2.2 [运行时执行流程](#22-运行时执行流程)
3. [地址语法规范](#3-地址语法规范)
   - 3.1 [标准完整语法](#31-标准完整语法)
   - 3.2 [字段定义](#32-字段定义)
   - 3.3 [语法约束规则](#33-语法约束规则)
4. [多场景地址示例](#4-多场景地址示例)
5. [文件兼容性与数据规则](#5-文件兼容性与数据规则)
6. [路径解析机制](#6-路径解析机制)
7. [地址双向转换](#7-地址双向转换)
8. [CLI 命令规范](#8-cli-命令规范)
9. [插件扩展开发规范](#9-插件扩展开发规范)
10. [认证与凭据管理](#10-认证与凭据管理)
11. [项目目录结构](#11-项目目录结构)
12. [AVFS AI 智能体技能](#12-avfs-ai-智能体技能)
13. [许可证声明](#13-许可证声明)
14. [相关链接](#14-相关链接)

---

## 1. 简介

### 1.1 概述

AVFS 是一款专为 AI 智能体设计的通用跨存储寻址协议。它将本地文件系统、HTTP/HTTPS 网络资源、局域网 SMB 共享存储以及多厂商 Git 版本仓库等异构分布式资源统一在标准化的 `avfs://` 地址模式之下。

该协议打破了不同存储介质、网络环境和服务厂商之间的访问边界。支持全类型二进制资源访问、版本定位、路径导航和扩展插件驱动访问能力，为智能体提供一致的资源定位、获取和管理逻辑。

### 1.2 核心设计目标

- 为 AI 智能体调度和知识检索建立全局统一资源命名空间
- 屏蔽底层存储与网络差异，简化上层访问逻辑
- 兼容主流现有资源，降低迁移和适配成本
- 支持灵活的协议驱动扩展以适配私有定制化存储服务
- 确保完整原始文件数据完整性，不修改原始二进制流

### 1.3 适用范围

- 本地磁盘全格式文件访问
- 内网及公网静态 Web 资源
- 局域网共享目录存储
- Git 分布式版本仓库（所有主流厂商）
- 通过插件扩展的自定义私有存储服务

---

## 2. 核心架构

### 2.1 协议-驱动插件机制

AVFS 采用一对一绑定插件结构：唯一协议标识对应独立访问驱动插件。核心运行时维护全局协议注册表来分发访问请求。

#### 2.1.1 内置官方协议与驱动映射

| 协议 | 匹配驱动 | 功能描述 |
|------|----------|----------|
| `file` | 本地文件系统驱动 | 本地磁盘文件 IO 读取与访问 |
| `http` | 明文 HTTP 驱动 | 未加密内网 Web 资源获取 |
| `https` | 安全 HTTPS 驱动 | 加密公网资源访问 |
| `smb` | SMB 共享驱动 | 局域网共享文件夹资源操作 |
| `git` | Git 仓库驱动 | 版本控制仓库文件检索 |

#### 2.1.2 插件生命周期

1. **注册**：将自定义协议字符串与自研驱动实例绑定
2. **路由**：解析器识别协议并将请求分派到目标插件
3. **处理**：驱动完成连接、认证、数据读取与元数据返回
4. **管理**：支持动态加载、卸载和热插拔，无需重启核心服务

### 2.2 运行时执行流程

```
AI 智能体发起请求
        ↓
AVFS 标准地址解析器
拆分协议、基础资源、版本、文件路径、锚点
        ↓
全局协议插件注册表
根据 protocol 字段匹配已注册驱动
        ↓
目标驱动插件执行
完成资源连接与二进制数据获取
        ↓
返回原始二进制流 + 资源元数据
        ↓
上层业务层处理、解析或持久化文件内容
```

---

## 3. 地址语法规范

### 3.1 标准完整语法

```
avfs://<proto>/<资源基础>[/<文件路径>][?ref=<版本>][#锚点]
```

### 3.2 字段定义

| 字段 | 必填 | 说明 | 适用范围 |
|------|------|------|----------|
| `proto` | 是 | 资源访问协议标识符，与已注册的驱动绑定 | 所有资源，支持自定义扩展 |
| `resource-base` | 是 | 磁盘位置、网络主机、完整原始仓库路径，保留各平台原生结构 | 所有资源 |
| `?ref=<version>` | 否 | 查询参数形式的版本标记：分支 / 标签 / 提交哈希 | 仅对 Git 协议有效，其他协议省略或忽略 |
| `file-path` | 是 | 内部目录文件路径，支持标准相对路径规则 | 所有资源 |
| `#anchor` | 否 | 精细定位标记：行号 Lxx 或段落锚点 | 所有资源 |

### 3.3 语法约束规则

- 版本通过 `?ref=` 查询参数指定（如 `?ref=main`），不再使用内联 `@` 语法——从根本上消除了分支名中包含 `/` 的歧义问题
- 非 Git 协议自动忽略 `?ref=` 参数，不会产生解析错误
- 相对路径 `./` 和 `../` 在所有资源中保持统一的解析逻辑
- 锚点必须出现在 URI 末尾（如有 `?ref=` 则在其之后），遵循 RFC 3986

---

## 4. 多场景地址示例

### 4.1 本地文件系统

覆盖所有二进制和文本文件格式。

```
avfs://file/d/work/service/config.json
avfs://file/home/system/release/app.bin
avfs://file/opt/data/report.pdf
avfs://file/../static/cover.png
```

### 4.2 HTTP 内网资源

```
avfs://http/192.168.3.20:8090/service/rule.yaml
avfs://http/inner.server/api/dataset.csv
```

### 4.3 HTTPS 公有云资源

```
avfs://https/avfs.io/spec/avfs-v1-standard.pdf
avfs://https/cdn.avfs.io/package/setup.zip
```

### 4.4 SMB 局域网共享存储

```
avfs://smb/192.168.1.60/share/business/record.xlsx
avfs://smb/office.host/public/media/demo.mp4
```

### 4.5 多厂商 Git 仓库

适配每个 Git 平台不规则的原始路径结构。

**GitHub**

```
avfs://git/github.com/avfs-io/core/readme.md
avfs://git/github.com/avfs-io/core/driver/smb.client?ref=dev
avfs://git/github.com/avfs-io/core/script/build.sh?ref=v1.0.0
avfs://git/github.com/avfs-io/core/module/kernel.so?ref=9a27c1f
```

**Azure DevOps**

```
avfs://git/dev.azure.com/team/org/_git/service/src/entry.jar?ref=main
avfs://git/dev.azure.com/team/org/_git/platform/util/check.dll?ref=hotfix
```

**自托管 Git 与 Bitbucket**

```
avfs://git/git.company.internal/ai/group/engine/doc/design.vsdx?ref=release
avfs://git/bitbucket.org/team/avfs-runtime/conf/env.ini?ref=main
```

### 4.6 自定义扩展协议

注册新协议和驱动后：

```
avfs://oss/bucket-name/object/data.backup
avfs://ftp/10.0.0.5/pub/package.iso
```

### 4.7 内容锚点定位

```
avfs://file/log/runtime.log#L120
avfs://git/github.com/avfs-io/spec/architecture.md?ref=main#core-routing
```

---

## 5. 文件兼容性与数据规则

### 5.1 全类型文件支持

AVFS 传输层仅负责地址路由，绝不修改原始二进制数据和文件头签名。

支持的文件类别：

- **文本源码**：md、txt、json、yaml、脚本代码
- **办公文档**：pdf、docx、xlsx、pptx
- **多媒体**：png、jpg、svg、mp4、音频
- **压缩包**：zip、tar、gz、iso
- **系统二进制**：exe、dll、so、固件
- 数据库备份和用户自定义私有格式

### 5.2 文件识别机制

- **后缀匹配**：快速默认格式判断
- **二进制头签名嗅探**：防止伪造后缀伪装
- **元数据辅助识别**：精确类型确认

### 5.3 跨协议数据一致性

同一资源通过不同访问协议获取后保持完全一致的字节数据，文件完整性不变。

---

## 6. 路径解析机制

以当前访问的资源基础地址作为虚拟工作目录：

- `./` 解析为同目录下的同级资源
- `../` 回退到上级目录

路径解析逻辑在内网、公网和 Git 仓库中保持统一。

---

## 7. 地址双向转换

原生路径与 AVFS 标准地址之间的无损映射：

- 本地路径 ↔ `avfs://file/`
- HTTP/HTTPS URL ↔ `avfs://http/` / `avfs://https/`
- SMB 共享路径 ↔ `avfs://smb/`
- Git 原始仓库地址 ↔ `avfs://git/`（带版本锁定）
- 自定义存储路径 ↔ 自定义协议地址

---

## 8. CLI 命令规范

轻量级命令行工具，用于日常资源操作。

### 8.1 基本命令格式

```bash
avfs [command] [options] <avfs-address>
```

### 8.2 常用命令

#### 8.2.1 获取资源

```bash
avfs fetch <avfs-address> [-o <本地保存路径>]
```

不指定 `-o` 时，内容流式输出到 stdout（管道友好）。

#### 8.2.2 地址转换

```bash
# 原生 → AVFS
avfs convert <源路径> --to-avfs

# AVFS → 原生
avfs convert <avfs地址> --to-native
```

当未指定 `--to-avfs` 或 `--to-native` 时，自动检测转换方向：
- 输入以 `avfs://` 开头 → `--to-native`
- 其他输入 → `--to-avfs`

`--to-avfs` 与 `--to-native` 互斥。

#### 8.2.3 地址解析

```bash
avfs stat <avfs-address>
```

输出 JSON 格式的解析结果：protocol、resourceBase、version、filePath、anchor。

#### 8.2.4 插件管理

```bash
avfs plugin list
avfs plugin load [插件路径]
avfs plugin unregister [协议名称]
```

#### 8.2.5 地址语法验证

```bash
avfs validate <avfs-address>
```

输出 JSON 格式，含 `valid` 标志和可选的 `errors` 数组。

### 8.3 通用选项

| 选项 | 功能 |
|------|------|
| `-o, --output` | 指定本地输出保存路径（`fetch` 命令） |

---

## 9. 插件扩展开发规范

- 定义专属自定义协议标识，避免与内置协议冲突
- 实现统一驱动接口，完成 connect、read、stat 基本方法
- 将开发的驱动注册到 AVFS 核心协议注册表
- 通过新的定制化 AVFS 地址格式访问扩展资源

---

## 10. 认证与凭据管理

AVFS 遵循**凭据路由与认证执行分离**的模式：
- **Core** 维护 `CredentialStore`，解析哪个凭据适用于哪个 `(protocol, resourceBase)` 对
- **Driver** 从 `DriverConfig.credentials` 消费凭据并执行自己的认证逻辑

这意味着每个驱动独立处理各自的认证机制（token、密码、证书、OAuth 等），而 Core 提供统一的凭据存储与查找。

**完整规范**：[authentication.md](./authentication.md)

认证规范涵盖的关键主题：
- 凭据存储接口与解析算法
- 基于模式的凭据匹配（`github.com/*`、`*.internal` 等）
- 凭据来源优先级（Agent 覆盖 > Vault > 配置文件 > 环境变量 > 匿名）
- 驱动认证契约与安全要求
- 凭据生命周期（注册、刷新、撤销）

---
## 11. 项目目录结构

```
avfs-io
├── docs/contents/en-us/spec    # AVFS 官方英文协议规范文档
├── docs/contents/zh-cn/spec    # AVFS 中文协议规范文档
├── core                        # 地址解析器、路径规范化、路由调度器、插件注册表
├── driver                      # 内置五类官方访问驱动
├── plugin-sdk                  # 自定义协议与驱动开发 SDK
├── sdk                         # 多语言官方开发 SDK
├── cli                         # 命令行工具源代码
├── skills                      # AI 智能体 SKILL 定义（avfs-skill）
├── examples                    # 全场景使用示例与自定义插件演示
└── docs                        # 官方网站静态资源源码
```

---

## 12. AVFS AI 智能体技能

AVFS 提供官方 AI 智能体技能（SKILL）—— 一个结构化的 Markdown 文档（`SKILL.md`），教导 AI 智能体（CodeBuddy、Cursor、Claude Code 等）以 `avfs` CLI 作为包装层，实现跨所有存储后端的自动地址识别、转换和内容获取。

### 12.1 技能位置

```
skills/avfs-skill/SKILL.md
```

### 12.2 技能涵盖范围

| 工作流 | CLI 命令 | 描述 |
|----------|------------|-------------|
| 地址识别与解析 | `avfs stat <address>` | 将 `avfs://` 地址解析为协议、主机、路径、版本、锚点 |
| 双向转换 | `avfs convert <path> --to-avfs` / `--to-native` | 原生路径/URL 与 AVFS 格式的无损映射 |
| 资源获取 | `avfs fetch <address> [-o path]` | 从任意存储后端下载或管道输出资源内容 |
| 元数据检查 | `avfs stat <address>` | 不下载即可检查文件大小、MIME 类型、时间戳 |
| 地址校验 | `avfs validate <address>` | 按 AVFS v1 语法规则进行语法检查 |
| 插件管理 | `avfs plugin list/load/unregister` | 管理自定义协议驱动 |

### 12.3 技能架构

SKILL 作为 CLI 之上的声明式指令层：

```
AI 智能体 → 加载 SKILL.md → 理解 AVFS 协议与 CLI
    → 接收用户的文件引用
    → 判定：校验？转换？获取？检查？
    → 执行相应的 avfs CLI 命令
    → 向用户返回内容 / 元数据 / 转换后的地址
```

SKILL 包含决策流程图、各协议转换规则、错误处理指南和常见组合模式（跨存储交叉引用、批量处理、Git 多版本对比）。

### 12.4 使用方式

将 `skills/avfs-skill/SKILL.md` 作为上下文文档加载到任意 AI 智能体平台中。智能体即可：

- 自动识别用户输入中的 `avfs://` URI
- 将任意文件引用（本地路径、URL、UNC 路径、Git URL）与 AVFS 格式互转
- 从任意已注册的存储后端获取并处理文件内容
- 在传递给下游工具前校验地址语法

---

## 13. 许可证声明

本协议规范及对应的实现代码基于 Apache License 2.0 开源。

- 允许个人学习、商业集成、代码修改和二次开发
- 所有修改内容必须明确标注变更说明
- 许可证包含固有专利使用授权，保护所有采用者的合法权利

完整许可证文本存储于项目根目录 [`LICENSE`](../../../../LICENSE) 文件中。

---

## 14. 相关链接

| 链接 | URL |
|------|-----|
| 官方网站 | https://avfs.io |
| GitHub 组织 | https://github.com/avfs-io |
| 上级 ASDM 项目 | https://asdm.ai |
