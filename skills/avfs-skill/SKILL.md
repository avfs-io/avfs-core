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
# Via npm (requires Node.js >= 20)
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
avfs://<proto>/<resource-base>[/<file-path>][?ref=<version>][#anchor]
```

| Field | Required | Description |
|-------|----------|-------------|
| `proto` | Yes | Access protocol: `file`, `http`, `https`, `smb`, `git`, or custom |
| `resource-base` | Yes | Host / disk / repository identifier (vendor-native structure) |
| `?ref=<version>` | No | Git version: branch, tag, or commit hash as query parameter (only valid for `git`) |
| `file-path` | Yes | Path to the file within the resource |
| `#anchor` | No | Line number (`#L42`) or named section anchor |

### Built-in Protocols

| Protocol | Storage Backend | Example |
|----------|----------------|---------|
| `file` | Local filesystem | `avfs://file/home/user/config.json` |
| `http` | Unencrypted HTTP | `avfs://http/192.168.1.100:8080/data.csv` |
| `https` | Secure HTTPS | `avfs://https/cdn.example.com/package.zip` |
| `smb` | SMB/CIFS LAN share | `avfs://smb/192.168.1.60/share/report.xlsx` |
| `git` | Git repositories (GitHub, GitLab, Azure DevOps, Bitbucket, self-hosted) | `avfs://git/github.com/avfs-io/core/readme.md?ref=main` |

---

## Core Workflows

### Workflow 1: Address Recognition & Parsing

When you see an `avfs://` address, recognize it as an AVFS resource and parse its components.

**CLI command**:
```bash
avfs stat <avfs-address>
```

`avfs stat` outputs parsed address components as JSON:
- Protocol type (`file`, `http`, `https`, `smb`, `git`)
- Resource base (host, repository identifier)
- Version (if present, from `?ref=` query parameter)
- File path within the resource
- Anchor (if present)

**Interpretation rules**:
- `avfs://file/...` → Local file. `resource-base` is the disk mount path segment.
- `avfs://http/...` or `avfs://https/...` → Web resource. `resource-base` is the host with optional port.
- `avfs://smb/...` → LAN shared storage. `resource-base` is `{host}` (host or IP only).
- `avfs://git/...` → Git repository. `resource-base` is the vendor-specific full repo path.
- If `?ref=` is present and protocol is `git`, resolve to the specified branch/tag/commit. For non-Git protocols, the `?ref=` parameter is ignored (no error).

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
| `avfs://git/github.com/avfs-io/core/script/build.sh?ref=v1.0.0` | `{"cloneUrl":"https://github.com/avfs-io/core.git","version":"v1.0.0","filePath":"script/build.sh"}` |

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
avfs fetch avfs://git/github.com/avfs-io/core/readme.md?ref=v1.0.0 -o readme.md
```

#### Fetch to stdout (pipe to other tools)

```bash
avfs fetch <avfs-address>
```

When `-o` is omitted, content is written to stdout. This is ideal for piping into analysis tools:
```bash
avfs fetch avfs://file/log/app.log | grep ERROR
avfs fetch avfs://git/github.com/team/repo/api-spec.yaml?ref=main | yq eval
```

#### Anchor-aware fetching

```bash
# Fetch only lines around line 120
avfs fetch avfs://file/log/runtime.log#L120

# Fetch only the section named "core-routing"
avfs fetch avfs://git/github.com/avfs-io/spec/architecture.md?ref=main#core-routing
```

**When to fetch vs. convert:**
- **Fetch** when you need the file's actual content (bytes)
- **Convert** when you need to translate the address format itself
- **Stat** when you need to inspect the parsed address components without downloading

---

### Workflow 4: Content Inspection (Without Downloading)

Inspect resource metadata without fetching the full content.

```bash
avfs stat <avfs-address>
```

This returns parsed address components as JSON: protocol, resourceBase, version, filePath, anchor.

**Use this when**:
- Debugging address resolution
- Verifying address syntax and field extraction
- Checking version or anchor values in an AVFS URI

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
- If `?ref=` present, value must be non-empty (git only)
- At most one `#anchor` suffix (must appear at end)
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
avfs fetch avfs://git/github.com/team/policy-repo/policy.md?ref=v2.0.0 -o /tmp/policy.md

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
# Validate all addresses from a list
while read -r addr; do
  echo "Validating: $addr"
  avfs validate "$addr"
done < avfs-addresses.txt
```

### Pattern 5: Git multi-version comparison

```bash
# Compare the same file across two Git versions
avfs fetch avfs://git/github.com/team/repo/changelog.md?ref=main -o /tmp/changelog-main.md
avfs fetch avfs://git/github.com/team/repo/changelog.md?ref=v1.0.0 -o /tmp/changelog-v1.md
diff /tmp/changelog-main.md /tmp/changelog-v1.md
```

---

## Git-Specific Notes

### Version Lock Semantics

| Version Type | Behavior | Example |
|-------------|----------|---------|
| Branch (`?ref=main`, `?ref=dev`) | **Floating** — resolves to latest commit on that branch | `avfs://git/.../readme.md?ref=main` |
| Tag (`?ref=v1.0.0`) | **Immutable** — always resolves to the same commit | `avfs://git/.../script/build.sh?ref=v1.0.0` |
| Commit hash (`?ref=9a27c1f`) | **Immutable** — pinpoints exact revision | `avfs://git/.../module/kernel.so?ref=9a27c1f` |

### Supported Git Platforms

| Platform | Native URL Pattern | AVFS Example |
|----------|-------------------|-------------|
| GitHub | `github.com/{owner}/{repo}` | `avfs://git/github.com/owner/repo/file.ts?ref=main` |
| GitLab | `gitlab.com/{group}/{project}` | `avfs://git/gitlab.com/group/project/file.ts?ref=main` |
| Azure DevOps | `dev.azure.com/{org}/{_git}/{repo}` | `avfs://git/dev.azure.com/org/project/_git/repo/file.ts?ref=main` |
| Bitbucket | `bitbucket.org/{workspace}/{repo}` | `avfs://git/bitbucket.org/workspace/repo/file.ts?ref=main` |
| Self-hosted | `{domain}/{path}/{repo}` | `avfs://git/git.company.internal/path/repo/file.ts?ref=main` |

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
| `Invalid AVFS address` | Syntax error in address | Check address format: `avfs://proto/resourceBase/filePath?ref=version#anchor` |
| Git fetch fails | Auth credentials missing | Check `~/.avfs/config.toml` — guide user to add credentials (see below) |
| `avfs stat` returns "protocol not found" | Data source not registered | Guide user to register the source via `avfs plugin load` or auth config |

### Graceful Handling: Missing Configuration or Authentication

When an AVFS operation fails because a data source is not yet configured or authentication is missing, **do not** simply report a raw error. Instead, follow this friendly remediation flow:

#### Step 1: Diagnose

Identify the root cause from the error output:

| Error Pattern | Root Cause |
|--------------|------------|
| `protocol not registered` / `unsupported protocol` | Data source not configured — no plugin or driver loaded for this protocol |
| `authentication required` / `401` / `403` / `permission denied` | Credentials missing or expired for this source |
| `connection refused` / `timeout` | Network or host unreachable — may be VPN or firewall |
| `file not found` / `404` | Path incorrect or resource doesn't exist at this address |
| `avfs: command not found` | CLI not installed — guide through installation |

#### Step 2: Report Friendly

Tell the user **what's missing** in plain language, **not** raw CLI errors:

```
Good:  "I can't reach the SMB share at 192.168.1.60 — it looks like
        the share credentials aren't configured yet. Want me to help
        you set that up?"

Bad:   "Error: avfs fetch failed with exit code 1: SMB authentication
        required. See avfs --help for details."
```

#### Step 3: Guide Through Setup

For each common missing-config scenario, provide the fix:

**Missing CLI installation:**
```bash
npm install -g @avfs/avfs-cli
```

**Missing protocol driver:**
```bash
avfs plugin list                          # check what's registered
avfs plugin load ./path/to/driver.so      # load the missing driver
```

**Missing credentials (SMB / Git / HTTP):**
Guide the user to edit `~/.avfs/config.toml` or set environment variables:
```toml
[git]
auth-token = "${GIT_TOKEN}"

[smb."192.168.1.60"]
username = "your-username"
password = "${SMB_PASSWORD}"
```

**Source not registered at all:**
Ask the user for the source details, then register it:
```bash
# Configure a new data source in ~/.avfs/config.toml
# or register a custom protocol plugin
avfs plugin load ./custom-driver.so
avfs convert <new-source-url> --to-avfs   # verify it works
```

#### Step 4: Verify

After the user completes setup, verify with a quick check:
```bash
avfs stat <avfs-address>   # confirm the source is now reachable
```

#### Key Principle

The user should never see raw tool errors. Every failure is an opportunity to guide them toward a working configuration — one step at a time, in plain language.

### Principle: No File Reorganization Needed

A core value of AVFS is that users do **not** need to restructure their files, create indexes, or follow special naming conventions for AI. Existing folders, URLs, and Git repos stay where they are. Once registered in AVFS, the Agent navigates them as-is. Do not ask the user to move files, rename directories, or create metadata files — AVFS eliminates that need.

---

## Global Options Reference

| Option | Short | Effect |
|--------|-------|--------|
| `--output` | `-o` | Set local output file path for `fetch` command |
| `--to-avfs` | — | Convert native path/URL to AVFS format (`convert` command) |
| `--to-native` | — | Convert AVFS address back to native format (`convert` command) |

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
   - Just need the parsed address → `avfs stat`
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
