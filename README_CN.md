# AVFS (Agent Virtual File System)

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)
![Specification](https://img.shields.io/badge/Type-Protocol%20Specification-orange.svg)

**通用跨存储寻址协议 - 面向 AI 智能体设计**

将本地磁盘、网络服务、局域网共享、Git 仓库统一为一致的 `avfs://` 寻址标准，使智能体以一个统一的、机器可读的 URI 定位、获取和引用**任何文件资源**。

[English](README.md) | **中文**

## AVFS 是什么？

AVFS 是一个虚拟文件系统**协议**，专为 **AI 智能体驱动的场景** 设计。它不存储文件——而是提供一套统一的地址方案，将异构存储后端（本地文件、HTTP/S、SMB、Git 仓库及自定义协议）映射到同一个机器可读的命名空间。

AVFS **不是**面向人类用户的通用文件系统。它是一个由 AI 智能体消费的协议：智能体加载 AVFS SKILL，读取 `avfs://` 地址，并智能地调用 `avfs` CLI 代为校验、转换、获取或检查资源。用户只需用自然语言描述需求，智能体将其翻译为 AVFS 操作。

### 怎么用（用户视角）

只需两步：

1. **加载 [AVFS SKILL](skills/avfs-skill/SKILL.md)** 到你的 AI 智能体中。SKILL 会自动安装 `avfs` CLI（如未安装），然后你配置数据源——文件路径、Web 端点、SMB 共享、Git 仓库及对应凭证。
2. **完成。** 你的 AI 智能体现在拥有通往所有数据源的万能钥匙。

```
       SKILL（入口）                       AI 智能体（日常使用）
┌──────────────────────────────┐      ┌─────────────────────────────┐
│                              │      │                             │
│  加载 AVFS SKILL             │      │  "帮我找上周项目启动会      │
│       ↓                      │      │   的会议笔记..."            │
│  自动安装 avfs CLI           │ ───► │                ↓            │
│       ↓                      │      │  avfs://file/.../notes.md   │
│  配置数据源：                 │      │  avfs://smb/.../meetings/   │
│  • /home/projects            │      │  avfs://git/.../wiki/...    │
│  • 内网 wiki                 │      │                ↓            │
│  • \\server\share            │      │  智能体搜索所有来源，        │
│  • github.com/team           │      │  找到笔记。                  │
└──────────────────────────────┘      └─────────────────────────────┘
```

SKILL 是入口。加载一次，配置好数据源，从此你不再需要告诉智能体文件在哪、怎么访问——它都知道，因为 AVFS 已经帮你接好了所有数据源。

**无需重组文件。** 现有的文件、文件夹、URL、Git 仓库保持原样不动。你不需要创建索引、遵循命名规范或为 AI 重构任何东西。只需在 AVFS 中注册一次数据源，剩下的交给智能体。

## 使用场景

> 以下所有场景均假定 **AI 智能体** 为主要消费者。智能体使用 [AVFS SKILL](skills/avfs-skill/SKILL.md) 理解用户意图并自动驱动 `avfs` CLI。

### 研究与分析

研究员让 AI 从本地文档目录中的论文、公司内网发布的分析文章、共享盘上的数据集中收集信息，然后综合成摘要。智能体通过 `avfs://` 地址拉取全部三个来源。研究员无需告诉它文件在哪、怎么访问。

```
avfs://file/home/researcher/docs/paper.pdf
avfs://https/intranet.company.com/articles/2024-overview.html
avfs://smb/fileserver.internal/datasets/q2-results.csv
```

一句自然语言问题，三个存储后端，零手动查找。

### 个人知识管理

用户的笔记散落在本地文件夹、云盘和 Git 知识库中。当用户问"找我关于 Alpha 项目的笔记"，AI 智能体通过统一的 `avfs://` 视角搜索全部三个来源。用户无需记住哪个平台存了什么——智能体自动导航。

### 团队协作

"帮我对比共享盘上最新的设计稿和 v2.0 发布时的版本。"AI 智能体通过 `avfs://` 拉取 SMB 上的设计文件，再从 Git 仓库取出版本标签对应的文件。无需猜测路径，无需手动构造 URL。

```
avfs://smb/studio.shared/projects/redesign/mockup.fig
avfs://git/github.com/team/product@v2.0/assets/mockup.fig
```

### 合规审计

审计员让 AI 验证生产环境配置是否与 Git 中的审批版本、文件服务器上的基线模板一致。三个来源，一个协议：智能体通过 `avfs://` 拉取全部三份文件，比对后报告差异——无需人工翻找。

### 新人入职

新同事问"架构文档在哪？"AI 智能体自动搜索本地入职资料目录、内网 Wiki、团队 Git 仓库的 `docs/` 文件夹——全部通过 `avfs://`。新同事无需被告知查哪个系统，直接拿到正确文件。

## 地址语法

```
avfs://<协议>/<资源基址>[@<版本>]/<文件路径>[#锚点]
```

| 字段 | 用途 |
|------|------|
| `协议` | 访问方式：`file`、`http`、`https`、`smb`、`git` 或自定义 |
| `资源基址` | 主机 / 磁盘 / 仓库标识 |
| `@版本` | Git 版本：分支、标签或提交哈希（可选） |
| `文件路径` | 资源内的文件路径 |
| `#锚点` | 行号（`#L42`）或命名段落锚点 |

## 示例速览

```
# 本地文件
avfs://file/home/user/config.json

# 远程 HTTP/HTTPS
avfs://https/avfs.io/spec/standard.pdf

# SMB 局域网共享
avfs://smb/192.168.1.60/share/report.xlsx

# Git 仓库（最新 / 分支 / 标签 / 提交）
avfs://git/github.com/avfs-io/core/readme.md
avfs://git/github.com/avfs-io/core@dev/src/main.go
avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh

# 内容锚点
avfs://file/log/app.log#L120
```

## 工作原理

```
AI 智能体 → avfs:// 地址 → 解析器（协议、主机、路径、版本、锚点）
                ↓
       插件注册表（匹配协议 → 驱动）
                ↓
    驱动（file | http | https | smb | git | 自定义）
                ↓
       原始二进制流 + 元数据
```

内置驱动：`file`、`http`、`https`、`smb`、`git`。可通过插件 SDK 扩展。

## 协议规范

所有详细规范文档位于 `docs/contents/` 目录下：

- [AVFS v1 标准](docs/contents/zh-cn/spec/avfs-v1-standard.md)
- [地址语法 (ABNF)](docs/contents/zh-cn/spec/address-syntax.md)
- [驱动接口](docs/contents/zh-cn/spec/driver-interface.md)
- [插件生命周期](docs/contents/zh-cn/spec/plugin-lifecycle.md)
- [转换规则](docs/contents/zh-cn/spec/conversion-rules.md)

**[→ 全部规范](docs/contents/zh-cn/spec/README.md)** | **[→ English Specs](docs/contents/en-us/spec/README.md)**

## AI 智能体技能 (Skills)

预设的 SKILL 文档，教导 AI 智能体（CodeBuddy、Cursor、Claude Code 等）使用 `avfs` CLI 自动完成地址识别、转换和内容获取：

| 技能 | 描述 |
|-------|-------------|
| [`avfs-skill`](skills/avfs-skill/SKILL.md) | 默认 AVFS 技能 — 地址解析、双向转换、资源获取、校验及插件管理 |

每个 SKILL 作为一层包装：将其加载到任意 AI 智能体中，智能体即可理解完整的 AVFS 工作流程 — 从识别 `avfs://` 地址到跨存储获取资源。

## 许可证

Apache License 2.0 — 详见 [LICENSE](LICENSE)。

## 相关链接

- 官方网站: [https://avfs.io](https://avfs.io)
- GitHub 组织: [https://github.com/avfs-io](https://github.com/avfs-io)

---
**[ASDM](https://asdm.ai) 项目 — https://asdm.ai**
