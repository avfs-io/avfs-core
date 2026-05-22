# AVFS (Agent Virtual File System)

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)
![Status](https://img.shields.io/badge/Status-Active%20Development-yellow.svg)
![GitHub Stars](https://img.shields.io/github/stars/avfs-io/avfs-core?style=social)
![GitHub Forks](https://img.shields.io/github/forks/avfs-io/avfs-core?style=social)
![GitHub Issues](https://img.shields.io/github/issues/avfs-io/avfs-core)
![GitHub PRs](https://img.shields.io/github/issues-pr/avfs-io/avfs-core)
![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen.svg)
![Specification](https://img.shields.io/badge/Type-Protocol%20Specification-orange.svg)

**通用跨存储寻址协议 - 面向 AI 智能体设计**
将本地磁盘、网络服务、局域网共享、Git 仓库统一为一致的 `avfs://` 寻址标准。

官方网站: [https://avfs.io](https://avfs.io)
GitHub 组织: [https://github.com/avfs-io](https://github.com/avfs-io)

[English](README.md) | **中文**

## 项目概述
AVFS 是一款专为 AI 智能体设计的通用虚拟文件系统协议。
它消除了异构存储资源之间的访问差异，提供单一标准化地址规范，使智能体能够在统一逻辑中定位、获取和管理**任何文件资源**。

不受文件格式、存储厂商、网络环境或部署架构的限制。所有资源均可通过一套规则进行访问、引用和追踪。

## 核心特性
- **统一协议**
  内置 5 种访问类型：`file`、`http`、`https`、`smb`、`git`
- **全格式文件支持**
  透明原始二进制流传输，兼容文本、办公文档、图片、视频、压缩包、二进制可执行文件及所有自定义文件类型
- **可扩展的协议-驱动插件系统**
  协议标识与访问驱动一一对应，支持自定义协议扩展
- **多厂商 Git 兼容**
  原生支持 GitHub、GitLab、Gitee、Azure DevOps、Bitbucket 及私有自托管 Git 服务
- **版本级精确定位**
  通过分支、标签和提交哈希访问文件快照
- **细粒度内容锚点**
  定位文件内的特定行或内容段落
- **相对路径原生解析**
  自动解析 `./` 当前目录和 `../` 上级目录路径逻辑
- **无损双向转换**
  在原始系统路径、网络 URL 和 AVFS 地址之间无缝转换
- **面向智能体设计**
  结构化机器可读地址，便于智能代理解析、路由和自动化处理
- **实用命令行工具**
  命令行工具，用于快速获取、转换、检查和管理 AVFS 资源

## 协议规范
- [协议标准 v1.0](docs/contents/zh-cn/spec/avfs-v1-standard.md) - AVFS 协议完整规范文档
- [地址语法](docs/contents/zh-cn/spec/address-syntax.md) - 地址格式语法与 ABNF 定义
- [驱动接口](docs/contents/zh-cn/spec/driver-interface.md) - 插件接口契约
- [插件生命周期](docs/contents/zh-cn/spec/plugin-lifecycle.md) - 插件状态机与管理
- [转换规则](docs/contents/zh-cn/spec/conversion-rules.md) - 双向地址转换规则

**[→ 查看全部规范文档](docs/contents/zh-cn/spec/README.md)** | **[English Version (en-us)](docs/contents/en-us/spec/README.md)**

## 插件与驱动架构
AVFS 采用**协议-驱动匹配插件机制**
每个唯一协议标识绑定一个独立的驱动插件。
核心系统维护协议注册表，将访问请求分派到对应的插件实现。

### 核心匹配规则
`协议名称 <--> 访问驱动插件`
- 内置官方插件
  - `file` → 本地文件系统 IO 驱动
  - `http` → 明文 HTTP 网络请求驱动
  - `https` → 加密 HTTPS 安全获取驱动
  - `smb` → 局域网共享存储访问驱动
  - `git` → 版本化 Git 仓库检索驱动
- 自定义扩展能力
  开发者可以注册新的协议标识并实现定制化的驱动插件，以适配私有存储、专有服务和定制传输协议。

### 插件生命周期
1. 协议注册：将自定义协议字符串与自研驱动绑定
2. 地址路由：解析器匹配协议并将请求分派到目标插件
3. 资源处理：驱动完成连接、认证、数据读取和元数据返回
4. 注销与热插拔：支持动态插件管理，无需重启核心服务

## 协议标准语法
```
avfs://<proto>/<资源基础>@<版本>/<文件路径>[#锚点]
```

### 字段定义
| 字段 | 说明 | 适用范围 |
|------|------|----------|
| `proto` | 资源访问协议，与注册的驱动插件匹配 | 所有资源，支持自定义扩展协议 |
| `resource-base` | 磁盘位置、网络主机、完整原始仓库路径 | 所有资源，保留 Git 平台的原生结构 |
| `@version` | Git 版本标识：分支名 / 标签 / 提交哈希 | Git 专用，其他协议省略 |
| `file-path` | 内部文件目录路径，支持标准相对路径规则 | 所有资源 |
| `#anchor` | 内容定位标记：行号 `Lxx` 或段落锚点 | 所有资源 |

## 地址示例
### 本地文件系统
覆盖所有本地磁盘文件，无格式限制
```
avfs://file/d/work/service/config.json
avfs://file/home/system/release/app.bin
avfs://file/opt/data/report.pdf
avfs://file/../static/cover.png
```

### HTTP 内网资源
```
avfs://http/192.168.3.20:8090/service/rule.yaml
avfs://http/inner.server/api/dataset.csv
```

### HTTPS 公有云资源
```
avfs://https/avfs.io/spec/avfs-v1-standard.pdf
avfs://https/cdn.avfs.io/package/setup.zip
```

### SMB 局域网共享存储
```
avfs://smb/192.168.1.60/share/business/record.xlsx
avfs://smb/office.host/public/media/demo.mp4
```

### 多厂商 Git 仓库
适配不同 Git 平台的不规则路径结构，无需强制路径重构。

**GitHub**
```
avfs://git/github.com/avfs-io/core/readme.md
avfs://git/github.com/avfs-io/core@dev/driver/smb.client
avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh
avfs://git/github.com/avfs-io/core@9a27c1f/module/kernel.so
```

**Azure DevOps**
```
avfs://git/dev.azure.com/team/org/_git/service@main/src/entry.jar
avfs://git/dev.azure.com/team/org/_git/platform@hotfix/util/check.dll
```

**自托管 Git 与 Bitbucket**
```
avfs://git/git.company.internal/ai/group/engine@release/doc/design.vsdx
avfs://git/bitbucket.org/team/avfs-runtime@main/conf/env.ini
```

### 自定义扩展协议示例
注册自定义协议和驱动后，可统一访问新类型资源
```
avfs://oss/bucket-name/object/data.backup
avfs://ftp/10.0.0.5/pub/package.iso
```

### 内容锚点定位
精确定位完整文件内的部分内容
```
avfs://file/log/runtime.log#L120
avfs://git/github.com/avfs-io/spec@main/architecture.md#core-routing
```

## 完全二进制流兼容性
AVFS 路由层仅完成定位和资源调度，**绝不修改原始二进制数据和文件头信息**。

- 获取后原始文件字节、签名头和元数据保持完全不变
- 统一识别机制：文件名后缀匹配 + 二进制头签名检测
- 支持所有主流和自定义文件扩展名
- 不同访问协议间保持一致的文件完整性

支持的完整文件类别：
文本源文件、办公文档、光栅/矢量图像、音视频、压缩包、系统二进制文件、固件、数据库备份、自定义格式文件。

## 路径解析机制
以当前访问的资源基础地址为虚拟工作目录，自动计算相对路径引用：
- `./` 解析为同目录同级资源
- `../` 回退到上级目录
路径逻辑在本地、内网、公网和 Git 仓库中保持统一。

## 运行时架构
```
AI 智能体调用
        ↓
AVFS 地址解析器
拆分协议、基础资源、版本、文件路径和锚点
        ↓
协议插件注册表
匹配已注册协议并分派到对应驱动
        ↓
匹配的驱动插件
├─ file → 本地文件系统 IO 访问
├─ http → 明文网络请求
├─ https → 加密安全网络获取
├─ smb → 局域网共享目录访问客户端
├─ git → 版本化仓库文件检索
└─ 自定义插件 → 用户定义的私有存储访问
        ↓
返回完整原始二进制流 + 资源元数据
        ↓
上层业务层处理、解析或持久化文件内容
```

## 双向地址转换
在原始访问地址和 AVFS 标准地址之间进行无损映射
- 本地文件路径 ↔ `avfs://file/`
- HTTP/HTTPS URL ↔ `avfs://http/` / `avfs://https/`
- SMB 共享路径 ↔ `avfs://smb/`
- Git 仓库原始地址 ↔ `avfs://git/` 带版本锁定
- 自定义存储路径 ↔ 自定义协议地址

## CLI 使用指南
AVFS 提供轻量级命令行工具，用于日常资源操作、地址转换和插件管理。

### 基本命令格式
```bash
avfs [command] [options] <avfs-address>
```

### 1. 获取资源
下载并保存远程/虚拟资源到本地磁盘
```bash
# 获取本地虚拟文件
avfs fetch avfs://file/d/work/config.json -o ./local-save/config.json

# 获取内网 HTTP 资源
avfs fetch avfs://http/192.168.3.20:8090/service/rule.yaml -o rule.yaml

# 获取指定 Git 版本文件
avfs fetch avfs://git/github.com/avfs-io/core@v1.0.0/readme.md -o avfs-readme.md

# 获取二进制包
avfs fetch avfs://https/cdn.avfs.io/package/setup.zip -o setup.zip
```

### 2. 地址转换
将原生路径/URL 转换为标准 AVFS 地址，支持反向转换
```bash
# 原始本地路径转 AVFS
avfs convert "D:\work\app.bin" --to-avfs

# HTTPS URL 转 AVFS
avfs convert "https://avfs.io/spec/standard.pdf" --to-avfs

# AVFS 转回原生原始地址
avfs convert avfs://smb/192.168.1.60/share/record.xlsx --to-native
```

### 3. 检查资源元数据
查看文件类型、大小、协议信息和文件头签名
```bash
avfs stat avfs://git/github.com/avfs-io/core@main/driver/git.go
avfs stat avfs://file/home/system/release/app.bin
```

### 4. 插件管理
注册、列表和重新加载扩展协议驱动
```bash
# 列出所有已加载的协议插件
avfs plugin list

# 加载自定义驱动插件
avfs plugin load ./plugins/oss-driver.so

# 注销未使用的协议
avfs plugin unregister oss
```

### 5. 验证地址语法
检查 AVFS 地址是否符合标准规范
```bash
avfs validate avfs://git/dev.azure.com/team/org/_git/service@main/src/entry.jar
```

### 常用 CLI 选项
| 选项 | 说明 |
|------|------|
| `-o, --output` | 设置本地输出保存路径 |
| `--to-avfs` | 将原始路径转换为 AVFS 格式 |
| `--to-native` | 将 AVFS 地址转回原生访问路径 |
| `-v, --verbose` | 打印详细运行日志 |
| `-q, --quiet` | 静默输出模式 |

## 仓库结构
```
avfs-io
├── docs/contents/en-us/spec  # AVFS 协议官方规范文档
├── core          # 地址解析、路径规范化、路由调度器、插件注册表
├── driver        # 内置五类官方访问驱动
├── plugin-sdk    # 自定义协议与驱动扩展开发 SDK
├── sdk           # 多语言官方开发 SDK
├── cli           # 命令行地址工具和资源获取器
├── examples      # 全场景跨存储使用示例及自定义插件演示
└── docs          # 官方网站静态资源源码
```

## 插件扩展开发
1. 定义专属的自定义协议标识，避免与内置协议冲突
2. 实现标准驱动接口，完成 connect、read、stat 基本方法
3. 将驱动实例注册到 AVFS 核心插件注册表
4. 通过新的 `avfs://custom-proto/` 地址格式访问扩展资源

## 设计价值
- 构建 AI 智能体调度、记忆管理和知识检索的全局统一资源命名空间
- 解决跨环境协作中的路径混乱、资源丢失和版本不一致问题
- 屏蔽底层存储差异，智能体只需关注业务逻辑而无需关心访问方式
- 松耦合插件设计，灵活扩展访问能力，适应多样化的企业私有存储
- 开放标准协议，兼容现有海量遗留资源，低迁移成本

## 许可证
本项目基于 **Apache License 2.0** 开源。

允许的使用包括个人学习、商业集成、代码修改和二次开发。
对源代码和协议实现的所有修改必须明确说明。
本许可包含固有专利授权，保护采用者的合法使用权。

完整许可证文本可在仓库根目录的 `LICENSE` 文件中查看。

## 相关链接
官方网站: https://avfs.io
GitHub 组织: https://github.com/avfs-io

---
**ASDM 旗下子项目**
https://asdm.ai
