# AVFS (Agent Virtual File System)

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)
![Specification](https://img.shields.io/badge/Type-Protocol%20Specification-orange.svg)

**Universal Cross-Storage Addressing Protocol for AI Agents**

Unify local disk, network service, LAN share, and Git repositories into one consistent `avfs://` addressing standard — so agents can locate, fetch, and reference **any file resource** with a single, machine-readable URI.

**English** | [中文](README_CN.md)

## What is AVFS?

AVFS is a virtual file system **protocol** designed exclusively for **AI Agent-driven scenarios**. It does not store files — it provides a unified address scheme that maps heterogeneous storage backends (local files, HTTP/S, SMB, Git repos, and custom protocols) into one machine-readable namespace.

AVFS is **not** a general-purpose file system for human users. It is a protocol consumed through AI Agents: the agent loads the AVFS SKILL, reads `avfs://` addresses, and intelligently invokes the `avfs` CLI to validate, convert, fetch, or inspect resources on behalf of the user. The user simply describes what they need in natural language; the agent translates that into AVFS operations.

### How It Works (for Users)

Getting started takes two steps:

1. **Load the [AVFS SKILL](skills/avfs-skill/SKILL.md)** into your AI Agent. The SKILL automatically installs the `avfs` CLI if needed, then you configure your data sources — file paths, web endpoints, SMB shares, Git repos, and their credentials.
2. **Done.** Your AI Agent now has a universal key to every configured source.

```
          SKILL (entry point)              AI Agent (every day)
┌──────────────────────────────┐      ┌─────────────────────────────┐
│                              │      │                             │
│  Load AVFS SKILL             │      │  "Find my notes from        │
│       ↓                      │      │   last week's meeting..."   │
│  Auto-install avfs CLI       │ ───► │                ↓            │
│       ↓                      │      │  avfs://file/.../notes.md   │
│  Configure sources:          │      │  avfs://smb/.../meetings/   │
│  • /home/projects            │      │  avfs://git/.../wiki/...    │
│  • intranet wiki             │      │                ↓            │
│  • \\server\share            │      │  Agent searches all         │
│  • github.com/team           │      │  sources, finds the notes.  │
└──────────────────────────────┘      └─────────────────────────────┘
```

The SKILL is the entry point. Load it once, configure your sources, and from then on you never tell the Agent where a file lives or how to access it — the Agent already knows, because AVFS connected everything.

**No reorganization needed.** Your existing files, folders, URLs, and Git repos stay exactly where they are. You don't need to create indexes, follow naming conventions, or restructure anything for AI. Just register each source once in AVFS, and the Agent handles the rest.

## Use Cases

> All scenarios below assume an **AI Agent** as the primary consumer. The agent uses the [AVFS SKILL](skills/avfs-skill/SKILL.md) to interpret user intent and drive the `avfs` CLI automatically.

### Research & Analysis

A researcher asks the AI to gather information from a local paper in their Documents folder, a published article on the company intranet, and a dataset on the shared drive — then synthesize a summary. The agent pulls all three through `avfs://` addresses. The researcher never tells it where anything lives or how to access it.

```
avfs://file/home/researcher/docs/paper.pdf
avfs://https/intranet.company.com/articles/2024-overview.html
avfs://smb/fileserver.internal/datasets/q2-results.csv
```

One question in natural language. Three storage backends. Zero manual lookups.

### Personal Knowledge Management

A user's notes are scattered across a local folder, a cloud drive, and a Git-backed wiki. When they ask "find my notes about project Alpha," the AI Agent searches all three sources through a single `avfs://` view. The user doesn't need to remember which platform holds which note — the agent navigates automatically.

### Team Collaboration

"Compare the latest mockup on the shared drive with the one we shipped in the v2.0 release." The AI Agent fetches the SMB-hosted design file, then pulls the Git-tagged version from the repo — both through `avfs://`. No path-guessing, no manual URL construction.

```
avfs://smb/studio.shared/projects/redesign/mockup.fig
avfs://git/github.com/team/product@v2.0/assets/mockup.fig
```

### Compliance & Audit

An auditor asks the AI to verify that the production config matches the approved version in Git and the baseline template on the file server. Three sources, one protocol: the agent fetches all three via `avfs://`, compares them, and reports discrepancies — no manual file hunting.

### New Team Member Onboarding

A new hire asks "where is the architecture documentation?" The AI Agent automatically searches the local onboarding directory, the internal wiki, and the `docs/` folder in the team's Git repo — all through `avfs://`. The new hire gets the right file without being told which system to look in.

## Address Syntax

```
avfs://<protocol>/<resource-base>[@<version>]/<file-path>[#anchor]
```

| Field | Purpose |
|-------|---------|
| `protocol` | Access method: `file`, `http`, `https`, `smb`, `git`, or custom |
| `resource-base` | Host / disk / repository identifier |
| `@version` | Git version: branch, tag, or commit hash (optional) |
| `file-path` | Path to the file within the resource |
| `#anchor` | Line number (`#L42`) or named section anchor |

## Quick Examples

```
# Local file
avfs://file/home/user/config.json

# Remote HTTP/HTTPS
avfs://https/avfs.io/spec/standard.pdf

# SMB LAN share
avfs://smb/192.168.1.60/share/report.xlsx

# Git repository (latest / branch / tag / commit)
avfs://git/github.com/avfs-io/core/readme.md
avfs://git/github.com/avfs-io/core@dev/src/main.go
avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh

# Content anchor
avfs://file/log/app.log#L120
```

## How It Works

```
AI Agent → avfs:// address → Parser (protocol, host, path, version, anchor)
                ↓
       Plugin Registry (match protocol → driver)
                ↓
    Driver (file | http | https | smb | git | custom)
                ↓
       Raw binary stream + metadata
```

Built-in drivers: `file`, `http`, `https`, `smb`, `git`. Extendable via the plugin SDK.

## Specification

All detailed protocol specifications are maintained under `docs/contents/`:

- [AVFS v1 Standard](docs/contents/en-us/spec/avfs-v1-standard.md)
- [Address Syntax (ABNF)](docs/contents/en-us/spec/address-syntax.md)
- [Driver Interface](docs/contents/en-us/spec/driver-interface.md)
- [Plugin Lifecycle](docs/contents/en-us/spec/plugin-lifecycle.md)
- [Conversion Rules](docs/contents/en-us/spec/conversion-rules.md)

**[→ All specs](docs/contents/en-us/spec/README.md)** | **[→ 中文规范](docs/contents/zh-cn/spec/README.md)**

## AI Agent Skills

Pre-built SKILL documents that teach AI Agents (CodeBuddy, Cursor, Claude Code, etc.) to use the `avfs` CLI for automatic address recognition, conversion, and content retrieval:

| Skill | Description |
|-------|-------------|
| [`avfs-skill`](skills/avfs-skill/SKILL.md) | Default AVFS skill — address parsing, bidirectional conversion, content fetching, validation, and plugin management |

Each SKILL serves as a wrapper: load it into any AI Agent, and the agent understands the full AVFS workflow — from recognizing `avfs://` addresses to fetching cross-storage resources.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Links

- Website: [https://avfs.io](https://avfs.io)
- GitHub: [https://github.com/avfs-io](https://github.com/avfs-io)

---
**An [ASDM](https://asdm.ai) Project — https://asdm.ai**
