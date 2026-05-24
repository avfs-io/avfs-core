# AVFS (Agent Virtual File System)

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)
![Specification](https://img.shields.io/badge/Type-Protocol%20Specification-orange.svg)

**通用跨存储寻址协议 - 面向 AI 智能体设计**

将本地磁盘、网络服务、局域网共享、Git 仓库统一为一致的 `avfs://` 寻址标准，使智能体以一个统一的、机器可读的 URI 定位、获取和引用**任何文件资源**。

[English](README.md) | **中文**

## AVFS 是什么？

AVFS 是一个虚拟文件系统**协议**。它不存储文件——而是提供一套统一的地址方案，将异构存储后端（本地文件、HTTP/S、SMB、Git 仓库及自定义协议）映射到同一个命名空间。AI 智能体只需知道 `avfs://...`，底层的协议插件完成其余工作。

## 使用场景

### 智能体驱动的工作流

AI 智能体被要求审阅一份文档，然后与局域网共享上的配置文件、以及 Git 仓库中某个特定提交的策略文件进行交叉比对。没有 AVFS，智能体需要在三种不同的访问方式间切换。有了 AVFS，只需三个地址：

```
avfs://file/home/docs/review-draft.md
avfs://smb/fileserver.internal/policies/config.yaml
avfs://git/github.com/team/policy-repo@a1b2c3d/policy.md
```

统一接口，零上下文切换。

### 跨环境 CI/CD

流水线需要从本地仓库拉取构建脚本、从内网 HTTP 服务获取测试数据、从 SMB 存储读取构建产物。AVFS 让每个阶段用相同的地址方案引用其输入——无需路径转换、无需硬编码 URL、无需环境相关的 hack。

### 知识检索与 RAG

嵌入流水线和检索增强生成（RAG）系统可以用单一命名空间索引整个组织的存储资源。`avfs://` 地址成为稳定、可追溯的片段溯源引用——无论来源是本地 PDF、Git 托管的 Markdown，还是内网 Wiki 页面。

### 多版本文档

无需复制即可引用同一文档在不同分支或发布版本的快照。比较 `avfs://git/...@main/api-spec.md` 与 `avfs://git/...@v2.0/api-spec.md` — 非常适合变更日志生成、合规审计和 API 兼容性检查。

### 私有存储扩展

拥有专有存储系统（对象存储、遗留 FTP、内部制品仓库）的组织可以注册自定义 AVFS 协议与驱动。注册后，所有内部工具和智能体都通过统一的 `avfs://custom-proto/...` 模式访问该存储，消除一次性集成。

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
