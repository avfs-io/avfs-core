# AVFS Skill — Universal Cross-Storage Addressing for AI Agents

**Skill Name**: `avfs-skill`
**Version**: 1.0.0
**Protocol**: [AVFS v1](https://avfs.io)

---

## Overview

This skill equips you, the AI Agent, with the ability to use the **Agent Virtual File System (AVFS)** CLI (`avfs`) to locate, recognize, convert, and retrieve file resources from any storage backend — local disk, HTTP/S, SMB LAN shares, Git repositories, and custom protocols — all through a unified `avfs://` address scheme.

Use this skill whenever:
- You encounter an `avfs://` URI and need to fetch, inspect, or validate it
- A user gives you a native file path, URL, Git reference, or SMB share path and you need to convert it to AVFS format
- You need to read content from a resource addressed by `avfs://...`
- You need to cross-reference files across heterogeneous storage systems (local + Git + web + LAN)
- You need to validate that an AVFS address is syntactically correct

---

## Prerequisites

The `avfs` CLI must be installed on the host system. If not available, install via:

```bash
# Via npm (requires Node.js >= 18)
npm install -g @avfs/avfs-cli

# Via install script
curl -sL https://get.avfs.io | bash

# Or download a pre-built binary from
# https://github.com/avfs-io/avfs-core/releases
```

Verify installation:

```bash
avfs --version
```

---

## AVFS Address Format

Every AVFS address follows this structure:

```
avfs://<proto>/<resource-base>[@<version>]/<file-path>[#anchor]
```

| Field | Required | Description |
|-------|----------|-------------|
| `proto` | Yes | Access protocol: `file`, `http`, `https`, `smb`, `git`, or custom |
| `resource-base` | Yes | Host / disk / repository identifier (vendor-native structure) |
| `@version` | No | Git version: branch, tag, or commit hash (only valid for `git`) |
| `file-path` | Yes | Path to the file within the resource |
| `#anchor` | No | Line number (`#L42`) or named section anchor |

### Built-in Protocols

| Protocol | Storage Backend | Example |
|----------|----------------|---------|
| `file` | Local filesystem | `avfs://file/home/user/config.json` |
| `http` | Unencrypted HTTP | `avfs://http/192.168.1.100:8080/data.csv` |
| `https` | Secure HTTPS | `avfs://https/cdn.example.com/package.zip` |
| `smb` | SMB/CIFS LAN share | `avfs://smb/192.168.1.60/share/report.xlsx` |
| `git` | Git repositories (GitHub, GitLab, Azure DevOps, Bitbucket, self-hosted) | `avfs://git/github.com/avfs-io/core@main/readme.md` |

---

## Core Workflows

### Workflow 1: Address Recognition & Parsing

When you see an `avfs://` address, recognize it as an AVFS resource and parse its components.

**CLI command**:
```bash
avfs stat <avfs-address>
```

`avfs stat` outputs parsed metadata:
- Protocol type (`file`, `http`, `https`, `smb`, `git`)
- Resource base (host, repository, share)
- Version (if present)
- File path within the resource
- Anchor (if present)
- File size, MIME type, last-modified timestamp

**Interpretation rules**:
- `avfs://file/...` → Local file. `resource-base` is the disk mount path.
- `avfs://http/...` or `avfs://https/...` → Web resource. `resource-base` is the host with optional port.
- `avfs://smb/...` → LAN shared storage. `resource-base` is `{host}/{share}`.
- `avfs://git/...` → Git repository. `resource-base` is the vendor-specific full repo path.
- If `@version` is present and protocol is `git`, resolve to the specified branch/tag/commit. For non-Git protocols, the `@version` field is ignored (no error).

---

### Workflow 2: Address Conversion (Native ↔ AVFS)

Convert between native paths/URLs and AVFS format bidirectionally.

#### Native → AVFS

```bash
avfs convert <native-path-or-url> --to-avfs
```

| Native Input | AVFS Output |
|-------------|-------------|
| `/home/user/config.json` | `avfs://file/home/user/config.json` |
| `http://192.168.1.100:8080/api/data.csv` | `avfs://http/192.168.1.100:8080/api/data.csv` |
| `https://cdn.example.com/files/package.zip` | `avfs://https/cdn.example.com/files/package.zip` |
| `\\192.168.1.60\share\docs\report.xlsx` | `avfs://smb/192.168.1.60/share/docs/report.xlsx` |
| `github.com/avfs-io/core` (default branch) | `avfs://git/github.com/avfs-io/core/readme.md` |

#### AVFS → Native

```bash
avfs convert <avfs-address> --to-native
```

| AVFS Address | Native Output |
|-------------|-------------|
| `avfs://file/home/user/doc.txt` | `/home/user/doc.txt` (Linux) / `C:\home\user\doc.txt` (Windows) |
| `avfs://https/avfs.io/spec/standard.pdf` | `https://avfs.io/spec/standard.pdf` |
| `avfs://smb/192.168.1.60/share/docs/report.xlsx` | `\\192.168.1.60\share\docs\report.xlsx` |
| `avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh` | Clone URL `github.com/avfs-io/core` at tag `v1.0.0`, path `script/build.sh` |

#### Batch Conversion

```bash
avfs convert --batch input-paths.txt --to-avfs --output converted-addrs.txt

# Pipe through stdin/stdout
cat urls.txt | avfs convert --from-format url --to-avfs
echo "avfs://file/data.bin" | avfs convert --to-native
```

#### Conversion Principles

- **Lossless round-trip**: `native → avfs → native` yields the identical resource reference
- **No data loss**: All information in the source address is preserved
- **Deterministic**: Same input always produces same output
- **Protocol lowercase**: Protocol identifiers are normalized to lowercase

**When to use which direction:**
- Use `--to-avfs` when a user gives you a conventional path/URL and you want to standardize it
- Use `--to-native` when you need to pass the address to tools that don't understand AVFS (e.g., `curl`, `git clone`, file manager)

---

### Workflow 3: Fetching & Reading Content

Retrieve the actual content of a resource addressed by an AVFS URI.

#### Fetch to local file

```bash
avfs fetch <avfs-address> -o <output-path>
```

**Examples**:
```bash
# Fetch a local file (effectively a copy)
avfs fetch avfs://file/home/user/config.json -o ./config.json

# Download an HTTPS resource
avfs fetch avfs://https/avfs.io/spec/standard.pdf -o standard.pdf

# Fetch from an SMB share
avfs fetch avfs://smb/192.168.1.60/share/report.xlsx -o report.xlsx

# Checkout a specific version from Git
avfs fetch avfs://git/github.com/avfs-io/core@v1.0.0/readme.md -o readme.md
```

#### Fetch to stdout (pipe to other tools)

```bash
avfs fetch <avfs-address>
```

When `-o` is omitted, content is written to stdout. This is ideal for piping into analysis tools:
```bash
avfs fetch avfs://file/log/app.log | grep ERROR
avfs fetch avfs://git/github.com/team/repo@main/api-spec.yaml | yq eval
```

#### Anchor-aware fetching

```bash
# Fetch only lines around line 120
avfs fetch avfs://file/log/runtime.log#L120

# Fetch only the section named "core-routing"
avfs fetch avfs://git/github.com/avfs-io/spec@main/architecture.md#core-routing
```

**When to fetch vs. convert:**
- **Fetch** when you need the file's actual content (bytes)
- **Convert** when you need to translate the address format itself
- **Stat** when you only need metadata (size, type, timestamps) without downloading

---

### Workflow 4: Content Inspection (Without Downloading)

Inspect resource metadata without fetching the full content.

```bash
avfs stat <avfs-address>
```

This returns:
- File size (bytes)
- MIME type (determined by suffix + binary header sniffing)
- Last modified timestamp
- Protocol and parsed address components
- Version info (for Git resources)

**Use this when**:
- Checking if a resource exists before fetching
- Determining file size before download
- Verifying MIME type
- Debugging address resolution

---

### Workflow 5: Address Validation

Validate that an AVFS address is syntactically correct.

```bash
avfs validate <avfs-address>
```

**Validation checks**:
- Starts with `avfs://`
- Contains exactly one protocol segment
- Non-empty `resource-base` and `file-path`
- At most one `@version` qualifier (non-empty if present)
- At most one `#anchor` suffix
- Protocol characters are valid (`[a-zA-Z][a-zA-Z0-9._-]*`)

**Return codes**: `0` for valid, non-zero for invalid.

**Use this before** passing AVFS addresses to other tools or when validating user-provided addresses.

---

### Workflow 6: Plugin Management

Manage custom protocol drivers for extended storage backends.

```bash
# List all registered protocol plugins
avfs plugin list

# Load a custom driver plugin
avfs plugin load ./my-s3-driver.so

# Unregister a protocol
avfs plugin unregister my-s3
```

**When to use**: When the project uses custom storage backends (S3, FTP, MinIO, etc.) that have been registered as AVFS plugins.

---

## Common Patterns & Recipes

### Pattern 1: Cross-reference a local file against a Git-hosted policy

```bash
# Step 1: Convert the local path to AVFS
avfs convert /home/user/docs/draft.md --to-avfs
# → avfs://file/home/user/docs/draft.md

# Step 2: Fetch the local file
avfs fetch avfs://file/home/user/docs/draft.md -o /tmp/draft.md

# Step 3: Fetch the policy from Git at a specific tag
avfs fetch avfs://git/github.com/team/policy-repo@v2.0.0/policy.md -o /tmp/policy.md

# Step 4: Compare (or process both with other tools)
diff /tmp/draft.md /tmp/policy.md
```

### Pattern 2: Validate and fetch in sequence

```bash
# Validate first
if avfs validate avfs://https/api.example.com/data.json; then
  # Then fetch
  avfs fetch avfs://https/api.example.com/data.json -o data.json
else
  echo "Invalid AVFS address"
fi
```

### Pattern 3: Convert and store for later use

```bash
# Convert a native path to AVFS and save it
avfs convert /home/user/work/important.xlsx --to-avfs > stored-address.txt

# Later: use the stored address
avfs fetch $(cat stored-address.txt) -o important.xlsx
```

### Pattern 4: Batch processing multiple addresses

```bash
# Convert a list of native paths to AVFS addresses
avfs convert --batch native-paths.txt --to-avfs --output avfs-addresses.txt

# Validate all addresses
while read -r addr; do
  echo "Validating: $addr"
  avfs validate "$addr"
done < avfs-addresses.txt
```

### Pattern 5: Git multi-version comparison

```bash
# Compare the same file across two Git versions
avfs fetch avfs://git/github.com/team/repo@main/changelog.md -o /tmp/changelog-main.md
avfs fetch avfs://git/github.com/team/repo@v1.0.0/changelog.md -o /tmp/changelog-v1.md
diff /tmp/changelog-main.md /tmp/changelog-v1.md
```

---

## Git-Specific Notes

### Version Lock Semantics

| Version Type | Behavior | Example |
|-------------|----------|---------|
| Branch (`@main`, `@dev`) | **Floating** — resolves to latest commit on that branch | `avfs://git/...@main/readme.md` |
| Tag (`@v1.0.0`) | **Immutable** — always resolves to the same commit | `avfs://git/...@v1.0.0/script/build.sh` |
| Commit hash (`@9a27c1f`) | **Immutable** — pinpoints exact revision | `avfs://git/...@9a27c1f/module/kernel.so` |

### Supported Git Platforms

| Platform | Native URL Pattern | AVFS Example |
|----------|-------------------|-------------|
| GitHub | `github.com/{owner}/{repo}` | `avfs://git/github.com/owner/repo@main/file.ts` |
| GitLab | `gitlab.com/{group}/{project}` | `avfs://git/gitlab.com/group/project@main/file.ts` |
| Azure DevOps | `dev.azure.com/{org}/{_git}/{repo}` | `avfs://git/dev.azure.com/org/project/_git/repo@main/file.ts` |
| Bitbucket | `bitbucket.org/{workspace}/{repo}` | `avfs://git/bitbucket.org/workspace/repo@main/file.ts` |
| Self-hosted | `{domain}/{path}/{repo}` | `avfs://git/git.company.internal/path/repo@main/file.ts` |

---

## Protocol-Specific Conversion Rules (Quick Reference)

### file protocol

```
Native:  /home/user/config.json
AVFS:    avfs://file/home/user/config.json

Native (Windows):  D:\work\app.bin
AVFS:              avfs://file/d/work/app.bin
```

### http/https protocol

```
URL:     http://192.168.1.100:8080/api/data.csv
AVFS:    avfs://http/192.168.1.100:8080/api/data.csv

URL:     https://cdn.example.com/files/v1/package.zip
AVFS:    avfs://https/cdn.example.com/files/v1/package.zip
```

**Note**: Default ports (80/443) are omitted from `resource-base`. Auth credentials in URLs (`user:pass@host`) are stripped and logged as a warning.

### smb protocol

```
UNC:     \\192.168.1.60\share\docs\report.xlsx
AVFS:    avfs://smb/192.168.1.60/share/docs/report.xlsx
```

### git protocol

```
GitHub URL:  https://github.com/avfs-io/core.git → avfs://git/github.com/avfs-io/core/...
SSH URL:     git@github.com:avfs-io/core.git → avfs://git/github.com/avfs-io/core/...
```

---

## Error Handling

### Common Errors and Resolutions

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| `avfs: command not found` | CLI not installed | Run `npm install -g @avfs/avfs-cli` |
| `Unsupported protocol: xyz` | Custom protocol driver not loaded | Run `avfs plugin load ./xyz-driver.so` |
| `validate` returns non-zero | Syntax error in address | Check address format against the spec above |
| `fetch` returns 404 | Resource path incorrect or unreachable | Verify with `avfs stat` first |
| `Multiple @ symbols` | Ambiguous version qualifier | Only the first `@` is treated as version delimiter |
| Git fetch fails | Auth credentials missing | Set `GIT_TOKEN` env var or configure `~/.avfs/config.toml` |

### Verbose Debugging

Add `-v` (or `--verbose`) to any command for detailed diagnostic output:

```bash
avfs fetch avfs://git/github.com/team/repo@main/src/main.go -o main.go -v
avfs stat avfs://smb/192.168.1.60/share/doc.pdf -v
```

---

## Global Options Reference

| Option | Short | Effect |
|--------|-------|--------|
| `--output` | `-o` | Set local output file path for `fetch` command |
| `--to-avfs` | — | Convert native path/URL to AVFS format (`convert` command) |
| `--to-native` | — | Convert AVFS address back to native format (`convert` command) |
| `--verbose` | `-v` | Enable detailed debug logging |
| `--quiet` | `-q` | Silent mode, suppress non-error output |
| `--config` | `-c` | Specify custom config file path (`~/.avfs/config.toml` by default) |
| `--no-color` | — | Disable colored output |
| `--batch` | — | Batch process multiple addresses from file (`convert` command) |
| `--from-format` | — | Specify input format for batch conversion (`convert` command) |

---

## Configuration

Default config: `~/.avfs/config.toml`

```toml
[default]
output-dir = "./downloads"
log-level = "info"

[plugins]
paths = ["~/.avfs/plugins/"]

[cache]
enabled = true
ttl = "1h"
dir = "~/.avfs/cache"

[git]
default-branch = "main"
auth-token = "${GIT_TOKEN}"
```

---

## Architecture Summary

```
AI Agent (You)
     ↓  invoke
avfs CLI Command
     ↓  dispatch
Core Engine (parser, registry, converter, router)
     ↓  route by protocol
Driver Plugin (file | http | https | smb | git | custom)
     ↓  read
Raw Binary Stream + Metadata
     ↓  return
AI Agent processes content
```

---

## Decision Flowchart

When a user provides a file reference, use this decision tree:

1. **Is it already an `avfs://` address?**
   - Yes → Validate with `avfs validate`. If valid, use `avfs stat` to inspect, then `avfs fetch` to read.
   - No → Go to step 2.

2. **What type is the reference?**
   - Local file path (`/home/...`, `C:\...`) → `avfs convert --to-avfs` → then fetch/stat
   - URL (`http://...`, `https://...`) → `avfs convert --to-avfs` → then fetch/stat
   - UNC share path (`\\...`) → `avfs convert --to-avfs` → then fetch/stat
   - Git repo reference (`github.com/...`, etc.) → `avfs convert --to-avfs` → then fetch/stat
   - Unknown format → Ask user to clarify the storage type

3. **Do you need the content or just the address?**
   - Need content → `avfs fetch`
   - Just need metadata → `avfs stat`
   - Just need the converted address → `avfs convert`

---

## Summary

| Task | Command |
|------|---------|
| Recognize/parse an AVFS address | `avfs stat <address>` |
| Convert native path/URL → AVFS | `avfs convert <path> --to-avfs` |
| Convert AVFS → native path/URL | `avfs convert <address> --to-native` |
| Fetch/download resource content | `avfs fetch <address> -o <output>` |
| Fetch to stdout (pipe) | `avfs fetch <address>` |
| Validate address syntax | `avfs validate <address>` |
| List registered protocols | `avfs plugin list` |
| Load custom driver | `avfs plugin load <path>` |
| Get version info | `avfs --version` |
| Get command help | `avfs help <command>` |

---

## Official Links

| Link | URL |
|------|-----|
| AVFS Official Website | [https://avfs.io](https://avfs.io) |
| AVFS GitHub Organization | [https://github.com/avfs-io](https://github.com/avfs-io) |
| ASDM Project | [https://asdm.ai](https://asdm.ai) |
