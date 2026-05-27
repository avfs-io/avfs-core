# AVFS Address Syntax Specification

> Part of [AVFS v1 Standard](./avfs-v1-standard.md) — Detailed address format grammar and field definitions.

## 1. Full Syntax Grammar

```
avfs://<proto>/<resource-base>[/<file-path>][?ref=<version>][#anchor]
```

### ABNF Representation

> **ABNF** is a meta-language defined by [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234) for formally specifying syntax rules, commonly used in IETF protocol standards.

```abnf
avfs-address   = "avfs://" proto "/" git-path [ "?" query ] [ "#" anchor ]
git-path       = resource-base [ "/" file-path ]
query          = ref-param *( "&" other-param )
ref-param      = "ref "=" branch
other-param    = param-name "=" param-value   ; reserved for future extensions
param-name     = *VCHAR
param-value    = *VCHAR
proto          = 1*ALPHA / (1*ALPHA *("-" / "_" / ".") 1*ALPHA)
resource-base  = *VCHAR ; vendor-specific, retains native path structure
                ; For git: platform-dependent format, e.g.
                ;   GitHub:   github.com/{owner}/{repo}
                ;   GitLab:   gitlab.com/{group}/{...subgroups}/{repo}
branch         = *VCHAR   ; Git branch/tag/commit; "/" requires NO encoding
tag            = 1*VCHAR   ; Git tag name, e.g. v1.0.0
commit-hash    = 7*HEXDIG  ; short or full Git commit SHA
file-path      = *(""/ segment)
segment        = *VCHAR
anchor         = line-anchor / named-anchor
line-anchor    = "L" 1*DIGIT
named-anchor   = 1*(ALPHA / DIGIT / "-" / "_")
```

> **Note on `?ref=` syntax**: Version (branch/tag/commit) is passed as a query parameter rather than an inline `@` suffix. This design choice eliminates the fundamental ambiguity between version path separators (`/` in branch names like `feat/login`) and file path separators.

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
| `smb` | SMB host or IP | `192.168.1.60` |
| `git` | Complete repository path (platform-specific) | `github.com/org/repo` |

#### Git Platform-Specific ResourceBase Formats

| Platform | Format | Segments After Host |
|----------|--------|-------------------|
| **GitHub** | `github.com/{owner}/{repo}` | Fixed: exactly 2 (owner + repo) |
| **GitLab** | `gitlab.com/{group}/{...subgroups}/{repo}` | Variable (deferred to GitLab driver) |
| **Bitbucket** | `bitbucket.org/{workspace}/{repo}` | Fixed: 2 |
| **Gitee** | `gitee.com/{owner}/{repo}` | Fixed: 2 |
| **Gitea/Self-hosted** | `{host}/{owner}/{repo}` | Fixed: 2 |

### 2.3 `?ref=<version>` — Version Qualifier

- **Type**: Query parameter (optional)
- **Applicable only**: `git` protocol
- **Ignored by**: All other protocols (query string ignored)
- **Key advantage**: Branch names can contain `/` without any encoding

**Version Types**:

| Type | Pattern | Example |
|------|---------|---------|
| Branch | Any valid branch name (no encoding needed!) | `?ref=dev`, `?ref=main`, `?ref=feature/auth` |
| Tag | Semantic version or custom tag | `?ref=v1.0.0`, `?ref=release-2024` |
| Commit Hash | Short (7+) or full (40) SHA | `?ref=9a27c1f`, `?ref=9a27c1f2b3...` |

**When omitted**: The platform's default branch is used (typically `main` or `master`).

### 2.4 `file-path` — Internal Resource Path

- **Type**: String (required for most protocols)
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
- **Position**: Must be at the end of URI per RFC 3986 (after query string)

**Anchor Types**:

| Type | Format | Example | Meaning |
|------|--------|---------|---------|
| Line number | `L{N}` | `#L120` | Line 120 of the file |
| Named anchor | `{name}` | `#core-routing` | Section/heading named "core-routing" |

## 3. Parsing Rules

### 3.1 Parser Algorithm

1. **Extract protocol**: Split on `://`, take the scheme prefix before it
2. **Split anchor**: Find `#` at the end of body, extract anchor (must be after `?` if present)
3. **Protocol extraction**: First segment before first `/` → `proto`; everything after `proto/` → remaining
4. **Query extraction**: If `?` found in remaining, split into `pathPart` and `queryString`. Extract `ref=` value from queryString as `version`.
5. **Platform-aware split** (git only): Use registered platform rules to split `pathPart` into `resourceBase` and `filePath`:
   - Match host prefix to a known platform (e.g., `github.com` → GitHub)
   - Apply platform's `splitAvfsPath()` rule (e.g., GitHub uses fixed 2-segment rule: `host/owner/repo`)
6. **Validation**: Ensure all required fields are present and valid

### 3.2 Edge Cases

| Input | Behavior |
|-------|----------|
| Empty `?ref=` value | Syntax error — ref must have non-empty value |
| No `?ref=` parameter | Version is `null` → use default branch |
| Multiple query params | Only `ref=` is parsed; others ignored/reserved |
| `/` in branch name | **No ambiguity** — naturally handled by query string: `?ref=feature/auth/login` |
| Anchor before query (e.g., `path#L10?ref=x`) | **Not recommended** — `#` terminates the URI per RFC 3986; query will be part of anchor |
| Non-git protocol with `?ref=` | Query string is silently ignored |
| Deeply nested repo path | Split follows platform rules (GitHub always takes exactly owner+repo after host) |

### 3.3 Validation Checklist

- [ ] Starts with `avfs://`
- [ ] Contains exactly one `proto` segment
- [ ] Contains non-empty `resourceBase`
- [ ] Contains non-empty `file-path`
- [ ] At most one `#anchor` suffix (must be at end)
- [ ] If `?ref=` present, value is non-empty
- [ ] `proto` contains only allowed characters

## 4. Address Normalization

Before processing, all addresses undergo normalization:

1. **Protocol lowercase**: Convert proto to lowercase (case-insensitive matching)
2. **Path cleanup**: Resolve `.` and `..` segments in file-path
3. **Slash normalization**: Collapse multiple consecutive slashes to single `/`
4. **Trim trailing slashes**: Remove trailing `/` from file-path (unless root)

**Example**:
```
Input:  avFs://FILE/github.com//user/../project/./src/?ref=main
Output: avfs://file/github.com/user/project/src?ref=main
```

## 5. Complete Examples Reference

See [Section 4](./avfs-v1-standard.md#4-multi-scenario-address-examples) of the main spec for categorized examples across all supported protocols.

## A. Migration Notes (v1 → v2)

This specification was updated from v1 (`@version` inline syntax) to v2 (`?ref=` query parameter syntax). Key changes:

| Aspect | v1 (Legacy) | v2 (Current) |
|--------|------------|--------------|
| Version syntax | `@main` inline | `?ref=main` query param |
| Branch with `/` | Required `%2F` encoding: `@feature%2Flogin` | Natural: `?ref=feature/login` |
| Default branch | Must specify `@main` | Omit `?ref=` entirely |
| Ambiguity risk | High (driver needed 404 retry) | None (parser resolves deterministically) |
