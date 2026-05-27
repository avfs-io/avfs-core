# AVFS 地址语法规范

> 属于 [AVFS v1 标准](./avfs-v1-standard.md) 的一部分 — 地址格式语法定义和字段说明。

## 1. 完整语法格式

```
avfs://<协议>/<资源基地址>[/<文件路径>][?ref=<版本>][#锚点]
```

### ABNF 表示法

> **ABNF** 是 [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234) 定义的形式化语法元语言，广泛用于 IETF 协议标准。

```abnf
avfs-address   = "avfs://" proto "/" git-path [ "?" query ] [ "#" anchor ]
git-path       = resource-base [ "/" file-path ]
query          = ref-param *( "&" other-param )
ref-param      = "ref "=" branch
other-param    = param-name "=" param-value   ; 预留给未来扩展
param-name     *VCHAR
param-value    = *VCHAR
proto          = 1*ALPHA / (1*ALPHA *("-" / "_" / ".") 1*ALPHA)
resource-base  = *VCHAR ; 与供应商相关，保留原生路径结构
                ; Git 协议下为平台特定格式，例如：
                ;   GitHub:   github.com/{owner}/{repo}
                ;   GitLab:   gitlab.com/{group}/{...subgroups}/{repo}
branch         = *VCHAR   ; Git 分支名/标签/提交号；"/" 无需编码！
tag            = 1*VCHAR   ; Git 标签名，如 v1.0.0
commit-hash    = 7*HEXDIG  ; 短（7位）或完整（40位）Git 提交 SHA
file-path      *(""/ segment)
segment        = *VCHAR
anchor         = line-anchor / named-anchor
line-anchor    = "L" 1*DIGIT
named-anchor   = 1*(ALPHA / DIGIT / "-" / "_")
```

> **关于 `?ref=` 语法的说明**：版本号（分支/标签/提交）通过查询参数传递而非内联的 `@` 后缀。这一设计选择从根本上消除了版本路径分隔符（分支名中的 `/` 如 `feat/login`）与文件路径分隔符之间的歧义问题。

## 2. 字段详解

### 2.1 `proto` — 协议标识符

- **类型**: 字符串（必填）
- **模式**: `[a-zA-Z][a-zA-Z0-9._-]*`
- **用途**: 绑定到协议注册表中的驱动插件
- **内置值**: `file`、`http`、`https`、`smb`、`git`
- **自定义**: 任何不与内置协议冲突的唯一字符串

**示例**：
```
file     → 本地文件系统驱动
https    → 安全 HTTPS 驱动
my-s3    → 自定义 S3 驱动（用户定义）
oss      → 自定义 OSS 驱动（用户定义）
```

### 2.2 `resource-base` — 资源基地址

- **类型**: 字符串（必填）
- **格式**: 因协议而异，保留供应商原生结构

| 协议 | resource-base 格式 | 示例 |
|------|-------------------|------|
| `file` | 绝对或相对文件系统路径 | `/home/user/project` |
| `http` | 主机名或 IP + 可选端口 | `192.168.1.100:8080` |
| `https` | 完全限定域名 | `cdn.example.com` |
| `smb` | SMB 主机或 IP | `192.168.1.60` |
| `git` | 完整仓库路径（平台特定） | `github.com/org/repo` |

#### Git 平台特定 ResourceBase 格式

| 平台 | 格式 | 主机后段数 |
|------|------|-----------|
| **GitHub** | `github.com/{owner}/{repo}` | 固定 2 段（owner + repo） |
| **GitLab** | `gitlab.com/{group}/{...subgroups}/{repo}` | 可变（由 GitLab driver 处理） |
| **Bitbucket** | `bitbucket.org/{workspace}/{repo}` | 固定 2 段 |
| **Gitee** | `gitee.com/{owner}/{repo}` | 固定 2 段 |
| **Gitea/自托管** | `{host}/{owner}/{repo}` | 固定 2 段 |

### 2.3 `?ref=<version>` — 版本限定符

- **类型**: 查询参数（可选）
- **仅适用于**: `git` 协议
- **其他协议**: 查询字符串被忽略
- **核心优势**: 分支名可包含 `/` 而无需任何编码

**版本类型**：

| 类型 | 模式 | 示例 |
|------|------|------|
| 分支 | 任意合法分支名（无需编码！） | `?ref=dev`、`?ref=main`、`?ref=feature/auth` |
| 标签 | 语义版本或自定义标签 | `?ref=v1.0.0`、`?ref=release-2024` |
| 提交哈希 | 短（7+位）或完整（40位）SHA | `?ref=9a27c1f`、`?ref=9a27c1f2b3...` |

**省略时**：使用平台的默认分支（通常为 `main` 或 `master`）。

### 2.4 `file-path` — 内部资源路径

- **类型**: 字符串（大多数协议下必填）
- **支持**: 相对路径导航（`./`、`../`）
- **分隔符**: 正斜杠 `/`（跨平台统一）

**示例**：
```
config.json                    — 根级别文件
src/main/java/App.java         — 嵌套目录路径
../lib/shared/utils.c          — 父目录遍历
./data/dataset.csv             — 当前目录引用
```

### 2.5 `#anchor` — 内容位置标记

- **类型**: 字符串（可选）
- **不影响**: 实际获取的资源内容
- **用途**: 获取后的内容定位
- **位置**: 必须位于 URI 末尾（按 RFC 3986，在查询字符串之后）

**锚点类型**：

| 类型 | 格式 | 示例 | 含义 |
|------|------|------|------|
| 行号 | `L{N}` | `#L120` | 文件的第 120 行 |
| 命名锚点 | `{name}` | `#core-routing` | 名为 "core-routing" 的章节/标题 |

## 3. 解析规则

### 3.1 解析算法

1. **提取协议**: 按 `://` 分割，取前面的方案前缀
2. **分割锚点**: 在 body 末尾找 `#`，提取锚点（必须在 `?` 之后）
3. **协议提取**: 第一个 `/` 前的段 → `proto`；`proto/` 之后的所有内容 → remaining
4. **查询参数提取**: 如果 remaining 中包含 `?`，分割为 `pathPart` 和 `queryString`。从 queryString 中提取 `ref=` 的值作为 `version`
5. **平台感知分割**（仅 git）：使用已注册的平台规则将 `pathPart` 分割为 `resourceBase` 和 `filePath`：
   - 匹配主机前缀到已知平台（如 `github.com` → GitHub）
   - 应用该平台的 `splitAvfsPath()` 规则（例如 GitHub 使用固定 2 段规则：`host/owner/repo`）
6. **验证**: 确保所有必填字段存在且有效

### 3.2 边界情况

| 输入 | 行为 |
|------|------|
| 空的 `?ref=` 值 | 语法错误 —— ref 必须有非空值 |
| 无 `?ref=` 参数 | version 为 `null` → 使用默认分支 |
| 多个查询参数 | 仅解析 `ref=`；其余忽略/预留 |
| 分支名中的 `/` | **无歧义** —— 由查询字符串自然处理：`?ref=feature/auth/login` |
| 锚点在查询之前（如 `path#L10?ref=x`） | **不推荐** —— 按 RFC 3986，`#` 终止 URI；查询字符串会成为锚点的一部分 |
| 非 git 协议带 `?ref=` | 查询字符串被静默忽略 |
| 深层嵌套仓库路径 | 按平台规则分割（GitHub 始终取 host 后恰好 owner + repo 两段） |

### 3.3 验证清单

- [ ] 以 `avfs://` 开头
- [ ] 包含且仅包含一个 `proto` 段
- [ ] 包含非空 `resourceBase`
- [ ] 包含非空 `file-path`
- [ ] 至多一个 `#anchor` 后缀（必须在末尾）
- [ ] 如果存在 `?ref=`，其值非空
- [ ] `proto` 仅包含允许的字符

## 4. 地址规范化

处理前，所有地址都经过规范化：

1. **协议小写**: 将 proto 转为小写（大小写不敏感匹配）
2. **路径清理**: 解析 file-path 中的 `.` 和 `..` 段
3. **斜杠规范化**: 将多个连续斜杠合并为单个 `/`
4. **去除尾部斜杠**: 移除 file-path 尾部的 `/`（根目录除外）

**示例**：
```
输入:  avFs://FILE/github.com//user/../project/./src/?ref=main
输出: avfs://file/github.com/user/project/src?ref=main
```

## 5. 完整示例参考

主规范[第 4 节](./avfs-v1-standard.md#4-multi-scenario-address-examples) 提供了按协议分类的完整示例。

## 附：迁移说明 (v1 → v2)

本规范已从 v1（`@version` 内联语法）更新至 v2（`?ref=` 查询参数语法）。主要变更：

| 方面 | v1 (旧版) | v2 (当前版) |
|------|----------|------------|
| 版本语法 | `@main` 内联 | `?ref=main` 查询参数 |
| 含 `/` 分支名 | 必须 `%2F` 编码：`@feature%2Flogin` | 自然书写：`?ref=feature/login` |
| 默认分支 | 必须显式写 `@main` | 可省略 `?ref=` |
| 歧义风险 | 高（driver 需要 404 重试） | 无（解析器确定性地解决） |
