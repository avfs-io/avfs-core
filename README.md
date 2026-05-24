# AVFS (Agent Virtual File System)

![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/Version-v1.0.0-green.svg)
![Specification](https://img.shields.io/badge/Type-Protocol%20Specification-orange.svg)

**Universal Cross-Storage Addressing Protocol for AI Agents**

Unify local disk, network service, LAN share, and Git repositories into one consistent `avfs://` addressing standard — so agents can locate, fetch, and reference **any file resource** with a single, machine-readable URI.

**English** | [中文](README_CN.md)

## What is AVFS?

AVFS is a virtual file system **protocol**. It does not store files — it provides a unified address scheme that maps heterogeneous storage backends (local files, HTTP/S, SMB, Git repos, and custom protocols) into one namespace. An AI agent only needs to know `avfs://...`; the underlying protocol plugin handles the rest.

## Use Cases

### Agent-Driven Workflows

An AI agent is asked to review a document, then cross-reference it against a config file on a LAN share and a policy in a Git repo at a specific commit. Without AVFS, the agent would need to juggle three different access mechanisms. With AVFS, it's three addresses:

```
avfs://file/home/docs/review-draft.md
avfs://smb/fileserver.internal/policies/config.yaml
avfs://git/github.com/team/policy-repo@a1b2c3d/policy.md
```

One uniform interface. Zero context-switching.

### Cross-Environment CI/CD

A pipeline needs to pull build scripts from a local repo, test data from an intranet HTTP service, and an artifact from SMB storage. AVFS lets every stage reference its inputs with the same address scheme — no path translation, no hardcoded URLs, no environment-specific hacks.

### Knowledge Retrieval & RAG

Embedding pipelines and retrieval-augmented generation (RAG) systems can index files from across an entire organization's storage landscape using a single namespace. `avfs://` addresses become stable, traceable references for chunk provenance — regardless of whether the source is a local PDF, a Git-hosted markdown, or an intranet wiki page.

### Multi-Version Documentation

Reference a single document across multiple branches or releases without duplicating it. Compare `avfs://git/...@main/api-spec.md` against `avfs://git/...@v2.0/api-spec.md` — ideal for changelog generation, compliance audits, and API compatibility checks.

### Private Storage Extension

Organizations with proprietary storage systems (object stores, legacy FTP, internal artifact registries) can register a custom AVFS protocol and driver. Once registered, every internal tool and agent accesses that storage through the same `avfs://custom-proto/...` pattern, eliminating one-off integrations.

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
