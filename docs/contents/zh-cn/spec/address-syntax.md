# AVFS 地址语法规范

> 属于 [AVFS v1 规范](./avfs-v1-standard.md) — 详细的地址格式语法定义与字段说明。

## 1. 完整语法格式

```
avfs://<proto>/<资源基础>@<版本>/<文件路径>[#锚点]
```

### ABNF 表示法

> **ABNF（增强巴科斯-诺尔范式）** 是由 [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234) 定义的元语言，用于形式化描述语法规则，广泛用于 IETF 协议标准。

```abnf
avfs-address   = "avfs://" proto "/" resource-base ["@" version] "/" file-path ["#" anchor]
proto          = 1*ALPHA / (1*ALPHA *("-" / "_" / ".") 1*ALPHA)
resource-base  = *VCHAR ; 各平台特定，保留原生路径结构
version        = branch / tag / commit-hash
branch         = 1*VCHAR ; Git 分支名
tag            = 1*VCHAR ; Git 标签名，如 v1.0.0
commit-hash    = 7*HEXDIG ; 短或完整 Git 提交 SHA
file-path      = *(""/ segment)
segment        = *VCHAR
anchor         = line-anchor / named-anchor
line-anchor    = "L" 1*DIGIT
named-anchor   = 1*(ALPHA / DIGIT / "-" / "_")
```

## 2. 字段详解

### 2.1 `proto` — 协议标识符

- **类型**：字符串（必填）
- **模式**：`[a-zA-Z][a-zA-Z0-9._-]*`
- **用途**：绑定到协议注册表中的已注册驱动插件
- **内置值**：`file`、`http`、`https`、`smb`、`git`
- **自定义值**：任何不与内置协议冲突的唯一字符串

**示例**：
```
file     → 本地文件系统驱动
https    → 安全 HTTPS 驱动
my-s3    → 自定义 S3 驱动（用户定义）
oss      → 自定义 OSS 驱动（用户定义）
```

### 2.2 `resource-base` — 基础资源定位符

- **类型**：字符串（必填）
- **格式**：取决于具体协议，保留各平台原生结构

| 协议 | resource-base 格式 | 示例 |
|------|-------------------|------|
| `file` | 绝对或相对文件系统路径 | `/home/user/project` |
| `http` | 主机名或 IP，可选端口 | `192.168.1.100:8080` |
| `https` | 完整域名 | `cdn.example.com` |
| `smb` | SMB 主机加共享名 | `192.168.1.60/share/docs` |
| `git` | 完整仓库路径（各平台特定） | `github.com/org/repo` |

### 2.3 `@version` — 版本限定符

- **类型**：字符串（可选）
- **仅适用于**：`git` 协议
- **其他协议**：忽略（不产生解析错误）

**版本类型**：

| 类型 | 模式 | 示例 |
|------|------|------|
| 分支 | 任意有效分支名 | `@dev`、`@main`、`@feature/auth` |
| 标签 | 语义版本或自定义标签 | `@v1.0.0`、`@release-2024` |
| 提交哈希 | 短（7位+）或完整（40位）SHA | `@9a27c1f`、`@9a27c1f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e` |

### 2.4 `file-path` — 内部资源路径

- **类型**：字符串（必填）
- **支持**：相对路径导航（`./`、`../`）
- **分隔符**：正斜杠 `/`（跨所有平台统一）

**示例**：
```
config.json                    — 根级文件
src/main/java/App.java         — 嵌套目录路径
../lib/shared/utils.c          — 上级目录遍历
./data/dataset.csv             — 当前目录引用
```

### 2.5 `#anchor` — 内容位置标记

- **类型**：字符串（可选）
- **不影响**：实际被获取的资源
- **用途**：获取后的内容定位

**锚点类型**：

| 类型 | 格式 | 示例 | 含义 |
|------|------|------|------|
| 行号 | `L{N}` | `#L120` | 文件的第 120 行 |
| 命名锚点 | `{name}` | `#core-routing` | 名为 "core-routing" 的章节/标题 |

## 3. 解析规则

### 3.1 解析算法

1. **提取协议**：按 `://` 分割，取其前的 scheme 前缀
2. **拆分组件**：移除 `avfs://` 后：
   - 第一个 `/` 之前的段落 → `proto`
   - `proto/` 之后到 `@` 或第二个 `/` 之间的内容 → `resource-base`
   - 如果存在 `@`：`@` 与下一个 `/` 之间的内容 → `version`
   - 最后一个 `/` 之后到 `#` 之前的内容 → `file-path`
   - 如果存在 `#`：`#` 之后的内容 → `anchor`

### 3.2 边界情况

| 输入 | 处理方式 |
|------|----------|
| 多个 `@` 符号 | 仅第一个 `@` 作为版本分隔符；后续 `@` 归入 `file-path` |
| `@` 后空版本 | 语法错误 —— 若存在 `@` 则版本不可为空 |
| 无 `file-path` 组件 | 语法错误 —— file-path 为必填项 |
| 非文本资源的锚点 | 发出警告；二进制文件忽略锚点 |
| URL 编码字符 | 解析时解码（`%20` → 空格） |

### 3.3 验证清单

- [ ] 以 `avfs://` 开头
- [ ] 包含恰好一个 `proto` 字段
- [ ] 包含非空的 `resource-base`
- [ ] 包含非空的 `file-path`
- [ ] 至多一个 `@version` 限定符
- [ ] 若存在 `version` 则不为空
- [ ] 至多一个 `#anchor` 后缀
- [ ] `proto` 仅包含允许的字符

## 4. 地址规范化

处理前，所有地址需经过规范化处理：

1. **协议小写**：将 proto 转为小写（大小写不敏感匹配）
2. **路径清理**：解析 file-path 中的 `.` 和 `..` 段
3. **斜杠归一化**：将多个连续斜杠合并为单个 `/`
4. **尾部斜杠去除**：移除 file-path 末尾的 `/`（根路径除外）

**示例**：
```
输入:  avFs://FILE/home//user/../project/./src/
输出: avfs://file/home/project/src
```

## 5. 完整示例参考

参见主规范[第 4 节](./avfs-v1-standard.md#4-多场景地址-examples)中按协议分类的完整示例。
