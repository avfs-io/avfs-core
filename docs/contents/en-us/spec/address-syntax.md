# AVFS Address Syntax Specification

> Part of [AVFS v1 Standard](./avfs-v1-standard.md) — Detailed address format grammar and field definitions.

## 1. Full Syntax Grammar

```
avfs://<proto>/<resource-base>@<version>/<file-path>[#anchor]
```

### ABNF Representation

> **ABNF** is a meta-language defined by [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234) for formally specifying syntax rules, commonly used in IETF protocol standards.

```abnf
avfs-address   = "avfs://" proto "/" resource-base ["@" version] "/" file-path ["#" anchor]
proto          = 1*ALPHA / (1*ALPHA *("-" / "_" / ".") 1*ALPHA)
resource-base  = *VCHAR ; vendor-specific, retains native path structure
version        = branch / tag / commit-hash
branch         = 1*VCHAR ; Git branch name
tag            = 1*VCHAR   ; Git tag name, e.g. v1.0.0
commit-hash    = 7*HEXDIG  ; short or full Git commit SHA
file-path      = *(""/ segment)
segment        = *VCHAR
anchor         = line-anchor / named-anchor
line-anchor    = "L" 1*DIGIT
named-anchor   = 1*(ALPHA / DIGIT / "-" / "_")
```

## 2. Field Breakdown

### 2.1 `proto` — Protocol Identifier

- **Type**: String (required)
- **Pattern**: `[a-zA-Z][a-zA-Z0-9._-]*`
- **Purpose**: Binds to a registered driver plugin in the protocol registry
- **Built-in values**: `file`, `http`, `https`, `smb`, `git`
- **Custom**: Any unique string not conflicting with built-in protocols

**Examples**:
```
file     → Local Filesystem Driver
https    → Secure HTTPS Driver
my-s3    → Custom S3 driver (user-defined)
oss      → Custom OSS driver (user-defined)
```

### 2.2 `resource-base` — Base Resource Locator

- **Type**: String (required)
- **Format**: Protocol-dependent, retains vendor-native structure

| Protocol | resource-base Format | Example |
|----------|---------------------|---------|
| `file` | Absolute or relative filesystem path | `/home/user/project` |
| `http` | Hostname or IP with optional port | `192.168.1.100:8080` |
| `https` | Fully qualified domain name | `cdn.example.com` |
| `smb` | SMB host with share name | `192.168.1.60/share/docs` |
| `git` | Complete repository path (vendor-specific) | `github.com/org/repo` |

### 2.3 `@version` — Version Qualifier

- **Type**: String (optional)
- **Applicable only**: `git` protocol
- **Ignored by**: All other protocols (no parsing error)

**Version Types**:

| Type | Pattern | Example |
|------|---------|---------|
| Branch | Any valid branch name | `@dev`, `@main`, `@feature/auth` |
| Tag | Semantic version or custom tag | `@v1.0.0`, `@release-2024` |
| Commit Hash | Short (7+) or full (40) SHA | `@9a27c1f`, `@9a27c1f2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e` |

### 2.4 `file-path` — Internal Resource Path

- **Type**: String (required)
- **Supports**: Relative path navigation (`./`, `../`)
- **Separator**: Forward slash `/` (unified across all platforms)

**Examples**:
```
config.json                    — file at root level
src/main/java/App.java         — nested directory path
../lib/shared/utils.c          — parent directory traversal
./data/dataset.csv             — current directory reference
```

### 2.5 `#anchor` — Content Position Marker

- **Type**: String (optional)
- **Does not change**: The actual resource being fetched
- **Used for**: Post-retrieval content positioning

**Anchor Types**:

| Type | Format | Example | Meaning |
|------|--------|---------|---------|
| Line number | `L{N}` | `#L120` | Line 120 of the file |
| Named anchor | `{name}` | `#core-routing` | Section/heading named "core-routing" |

## 3. Parsing Rules

### 3.1 Parser Algorithm

1. **Extract protocol**: Split on `://`, take the scheme prefix before it
2. **Split components**: After removing `avfs://`:
   - First segment before first `/` → `proto`
   - Everything after `proto/` up to `@` or second `/` → `resource-base`
   - If `@` present: content between `@` and next `/` → `version`
   - Content after last `/` before `#` → `file-path`
   - If `#` present: content after `#` → `anchor`

### 3.2 Edge Cases

| Input | Behavior |
|-------|----------|
| Multiple `@` symbols | Only first `@` treated as version delimiter; subsequent `@` is part of `file-path` |
| Empty version after `@` | Syntax error — version must be non-empty if `@` present |
| No `file-path` component | Syntax error — file-path is mandatory |
| Anchor in non-text resource | Warning issued; anchor ignored for binary files |
| URL-encoded characters | Decoded during parsing (`%20` → space) |

### 3.3 Validation Checklist

- [ ] Starts with `avfs://`
- [ ] Contains exactly one `proto` segment
- [ ] Contains non-empty `resource-base`
- [ ] Contains non-empty `file-path`
- [ ] At most one `@version` qualifier
- [ ] If present, `version` is non-empty
- [ ] At most one `#anchor` suffix
- [ ] `proto` contains only allowed characters

## 4. Address Normalization

Before processing, all addresses undergo normalization:

1. **Protocol lowercase**: Convert proto to lowercase (case-insensitive matching)
2. **Path cleanup**: Resolve `.` and `..` segments in file-path
3. **Slash normalization**: Collapse multiple consecutive slashes to single `/`
4. **Trim trailing slashes**: Remove trailing `/` from file-path (unless root)

**Example**:
```
Input:  avFs://FILE/home//user/../project/./src/
Output: avfs://file/home/project/src
```

## 5. Complete Examples Reference

See [Section 4](./avfs-v1-standard.md#4-multi-scenario-address-examples) of the main spec for categorized examples across all supported protocols.
