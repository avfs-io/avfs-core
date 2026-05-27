# AVFS Specification v1.0

**Agent Virtual File System Universal Addressing Protocol**

| Field | Value |
|-------|-------|
| Official Site | https://avfs.io |
| Parent Project | ASDM https://asdm.ai |
| GitHub | https://github.com/avfs-io |
| License | Apache License 2.0 |

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 [Overview](#11-overview)
   - 1.2 [Core Design Goals](#12-core-design-goals)
   - 1.3 [Application Scope](#13-application-scope)
2. [Core Architecture](#2-core-architecture)
   - 2.1 [Protocol-Driver Plugin Mechanism](#21-protocol-driver-plugin-mechanism)
   - 2.2 [Runtime Execution Flow](#22-runtime-execution-flow)
3. [Address Syntax Specification](#3-address-syntax-specification)
   - 3.1 [Standard Full Syntax](#31-standard-full-syntax)
   - 3.2 [Field Definition](#32-field-definition)
   - 3.3 [Syntax Constraint Rules](#33-syntax-constraint-rules)
4. [Multi-Scenario Address Examples](#4-multi-scenario-address-examples)
5. [File Compatibility & Data Rule](#5-file-compatibility--data-rule)
6. [Path Resolution Mechanism](#6-path-resolution-mechanism)
7. [Address Bidirectional Conversion](#7-address-bidirectional-conversion)
8. [CLI Command Specification](#8-cli-command-specification)
9. [Plugin Extension Development Specification](#9-plugin-extension-development-specification)
10. [Authentication & Credential Management](#10-authentication--credential-management)
11. [Project Directory Structure](#11-project-directory-structure)
12. [AVFS AI Agent Skill](#12-avfs-ai-agent-skill)
13. [License Statement](#13-license-statement)
14. [Related Links](#14-related-links)

---

## 1. Introduction

### 1.1 Overview

AVFS is a universal cross-storage addressing protocol designed exclusively for AI Agents. It unifies heterogeneous distributed resources including local filesystem, HTTP/HTTPS web resources, LAN SMB shared storage and multi-vendor Git version repositories under one standardized `avfs://` address schema.

The protocol breaks access boundary of different storage medium, network environment and service vendor. It supports full-type binary resource access, version positioning, path navigation and extended plugin-driven access capability, providing consistent resource locating, fetching and managing logic for intelligent agents.

### 1.2 Core Design Goals

- Establish global unified resource namespace for AI agent scheduling and knowledge retrieval
- Shield underlying storage and network difference, simplify upper-layer access logic
- Compatible with mainstream existing resources, low migration and adaptation cost
- Support flexible protocol driver extension to adapt private customized storage services
- Ensure complete original file data integrity without modifying raw binary stream

### 1.3 Application Scope

- Local disk all-format file access
- Intranet & public web static resources
- Local area network shared directory storage
- Git distributed version repository (all mainstream vendors)
- Custom private storage service extended by plugin

---

## 2. Core Architecture

### 2.1 Protocol-Driver Plugin Mechanism

AVFS adopts one-to-one binding plugin structure: unique protocol identifier corresponds to independent access driver plugin. Core runtime maintains global protocol registry to dispatch access requests.

#### 2.1.1 Built-in Official Protocol & Driver Mapping

| Protocol | Matching Driver | Function Description |
|----------|----------------|----------------------|
| `file` | Local Filesystem Driver | Local disk file IO read and access |
| `http` | Plain HTTP Driver | Unencrypted intranet web resource fetch |
| `https` | Secure HTTPS Driver | Encrypted public network resource access |
| `smb` | SMB Shared Driver | LAN shared folder resource operation |
| `git` | Git Repository Driver | Version-controlled repository file retrieval |

#### 2.1.2 Plugin Lifecycle

1. **Register**: Bind custom protocol string with self-developed driver instance
2. **Route**: Parser identifies protocol and dispatch request to target plugin
3. **Process**: Driver complete connection, authentication, data reading and metadata return
4. **Manage**: Support dynamic loading, unloading and hot swap without core service restart

### 2.2 Runtime Execution Flow

```
AI Agent Invoke Request
        ↓
AVFS Standard Address Parser
Split protocol, base resource, version, file path, anchor
        ↓
Global Protocol Plugin Registry
Match registered driver according protocol field
        ↓
Target Driver Plugin Execution
Complete resource connection and binary data acquisition
        ↓
Return Raw Binary Stream + Resource Metadata
        ↓
Upper business layer process, parse or persist file content
```

---

## 3. Address Syntax Specification

### 3.1 Standard Full Syntax

```
avfs://<proto>/<resource-base>[/<file-path>][?ref=<version>][#anchor]
```

### 3.2 Field Definition

| Field | Mandatory | Description | Applicable Scope |
|-------|-----------|-------------|------------------|
| `proto` | Yes | Resource access protocol identifier, bound with registered driver | All resources, support custom extension |
| `resource-base` | Yes | Disk location, network host, complete original repository path, retain vendor native structure | All resources |
| `?ref=<version>` | No | Query parameter for version: branch / tag / commit hash | Only valid for Git protocol, omitted or ignored otherwise |
| `file-path` | Yes | Inner directory file path, support standard relative path rule | All resources |
| `#anchor` | No | Fine positioning mark: line number Lxx or section anchor | All resources |

### 3.3 Syntax Constraint Rules

- Version is specified via `?ref=` query parameter (e.g. `?ref=main`), not inline `@` syntax — eliminates ambiguity when branch names contain `/`
- Non-Git protocol automatically ignore `?ref=` parameter, no parsing error
- Relative path `./` and `../` keep unified resolution logic across all resources
- Anchor mark must appear at the end of URI (after `?ref=` if present), per RFC 3986

---

## 4. Multi-Scenario Address Examples

### 4.1 Local File System

Covers all binary and text file formats.

```
avfs://file/d/work/service/config.json
avfs://file/home/system/release/app.bin
avfs://file/opt/data/report.pdf
avfs://file/../static/cover.png
```

### 4.2 HTTP Intranet Resource

```
avfs://http/192.168.3.20:8090/service/rule.yaml
avfs://http/inner.server/api/dataset.csv
```

### 4.3 HTTPS Public Cloud Resource

```
avfs://https/avfs.io/spec/avfs-v1-standard.pdf
avfs://https/cdn.avfs.io/package/setup.zip
```

### 4.4 SMB LAN Shared Storage

```
avfs://smb/192.168.1.60/share/business/record.xlsx
avfs://smb/office.host/public/media/demo.mp4
```

### 4.5 Multi-Vendor Git Repository

Adapt irregular native path structure of each Git platform.

**GitHub**

```
avfs://git/github.com/avfs-io/core/readme.md
avfs://git/github.com/avfs-io/core/driver/smb.client?ref=dev
avfs://git/github.com/avfs-io/core/script/build.sh?ref=v1.0.0
avfs://git/github.com/avfs-io/core/module/kernel.so?ref=9a27c1f
```

**Azure DevOps**

```
avfs://git/dev.azure.com/team/org/_git/service/src/entry.jar?ref=main
avfs://git/dev.azure.com/team/org/_git/platform/util/check.dll?ref=hotfix
```

**Self-hosted Git & Bitbucket**

```
avfs://git/git.company.internal/ai/group/engine/doc/design.vsdx?ref=release
avfs://git/bitbucket.org/team/avfs-runtime/conf/env.ini?ref=main
```

### 4.6 Custom Extended Protocol

After registering new protocol and driver:

```
avfs://oss/bucket-name/object/data.backup
avfs://ftp/10.0.0.5/pub/package.iso
```

### 4.7 Content Anchor Positioning

```
avfs://file/log/runtime.log#L120
avfs://git/github.com/avfs-io/spec/architecture.md?ref=main#core-routing
```

---

## 5. File Compatibility & Data Rule

### 5.1 Full File Type Support

AVFS transmission layer only routes address, never modify original binary data and file header signature.

Supported file categories:

- **Text source**: md, txt, json, yaml, script code
- **Office document**: pdf, docx, xlsx, pptx
- **Multimedia**: png, jpg, svg, mp4, audio
- **Compressed package**: zip, tar, gz, iso
- **System binary**: exe, dll, so, firmware
- Database backup and user-defined private format

### 5.2 File Identification Mechanism

- **Suffix matching**: fast default format judgment
- **Binary header signature sniffing**: prevent fake suffix disguise
- **Metadata auxiliary recognition**: accurate type confirmation

### 5.3 Cross-Protocol Data Consistency

Same resource acquired via different access protocols keeps identical byte data, file integrity unchanged.

---

## 6. Path Resolution Mechanism

Take current accessed resource base as virtual working directory:

- `./` resolve to sibling resource under same directory
- `../` roll back to upper level directory

Path resolution logic unified in local, intranet, public network and Git repository.

---

## 7. Address Bidirectional Conversion

Lossless mapping between native path and AVFS standard address:

- Local path ↔ `avfs://file/`
- HTTP/HTTPS URL ↔ `avfs://http/` / `avfs://https/`
- SMB shared path ↔ `avfs://smb/`
- Git original repository address ↔ `avfs://git/` (with version lock)
- Custom storage path ↔ self-defined protocol address

---

## 8. CLI Command Specification

Lightweight command line tool for daily resource operation.

### 8.1 Basic Command Format

```bash
avfs [command] [options] <avfs-address>
```

### 8.2 Common Commands

#### 8.2.1 Fetch Resource

```bash
avfs fetch <avfs-address> [-o <local-save-path>]
```

When `-o` is omitted, content is streamed to stdout (pipe-friendly).

#### 8.2.2 Address Conversion

```bash
# Native → AVFS
avfs convert <source-path> --to-avfs

# AVFS → Native
avfs convert <avfs-address> --to-native
```

When neither `--to-avfs` nor `--to-native` is specified, direction is auto-detected:
- Input starting with `avfs://` → `--to-native`
- Other input → `--to-avfs`

`--to-avfs` and `--to-native` are mutually exclusive.

#### 8.2.3 Address Parsing

```bash
avfs stat <avfs-address>
```

Outputs parsed address components as JSON: protocol, resourceBase, version, filePath, anchor.

#### 8.2.4 Plugin Management

```bash
avfs plugin list
avfs plugin load [plugin-path]
avfs plugin unregister [proto-name]
```

#### 8.2.5 Address Syntax Validation

```bash
avfs validate <avfs-address>
```

Outputs JSON with `valid` flag and optional `errors` array.

### 8.3 General Options

| Option | Function |
|--------|----------|
| `-o, --output` | Specify local output saving path (for `fetch` command) |

---

## 9. Plugin Extension Development Specification

- Define exclusive custom protocol identifier, avoid conflict with built-in protocol
- Implement unified driver interface, complete connect, read, stat basic methods
- Register developed driver into AVFS core protocol registry
- Access extended resource via new customized AVFS address format

---

## 10. Authentication & Credential Management

AVFS follows a **separation of credential routing and authentication execution** model:
- **Core** maintains a `CredentialStore` that resolves which credentials apply to which `(protocol, resourceBase)` pair
- **Drivers** consume credentials from `DriverConfig.credentials` and execute their own authentication logic

This means every driver independently handles its own auth mechanism (token, password, certificate, OAuth, etc.), while the core provides unified credential storage and lookup.

**Full specification**: [authentication.md](./authentication.md)

Key topics covered in the authentication spec:
- Credential Store interface and resolution algorithm
- Pattern-based credential matching (`github.com/*`, `*.internal`, etc.)
- Credential source priority (agent override > vault > config file > env > anonymous)
- Driver authentication contract and security requirements
- Credential lifecycle (registration, refresh, revocation)

---
## 11. Project Directory Structure

```
avfs-io
├── docs/contents/en-us/spec      # AVFS English protocol specification
├── docs/contents/zh-cn/spec      # AVFS Chinese protocol specification
├── core                          # Address parser, path normalization, routing scheduler, plugin registry
├── driver                        # Built-in five official access drivers
├── plugin-sdk                    # Custom protocol & driver development SDK
├── sdk                           # Multi-language official development SDK
├── cli                           # Command line tool source code
├── skills                        # AI Agent SKILL definitions (avfs-skill)
├── examples                      # Full-scenario usage & custom plugin demo
└── docs                          # Official website static resource source
```

---

## 12. AVFS AI Agent Skill

AVFS provides an official AI Agent SKILL — a structured markdown document (`SKILL.md`) that teaches AI Agents (CodeBuddy, Cursor, Claude Code, etc.) to use the `avfs` CLI as a wrapper, enabling automatic address recognition, conversion, and content retrieval across all storage backends.

### 12.1 Skill Location

```
skills/avfs-skill/SKILL.md
```

### 12.2 What the Skill Covers

| Workflow | CLI Command | Description |
|----------|------------|-------------|
| Address Recognition & Parsing | `avfs stat <address>` | Parse `avfs://` address into protocol, host, path, version, anchor |
| Bidirectional Conversion | `avfs convert <path> --to-avfs` / `--to-native` | Lossless mapping between native paths/URLs and AVFS format |
| Resource Fetching | `avfs fetch <address> [-o path]` | Download or pipe resource content from any storage backend |
| Metadata Inspection | `avfs stat <address>` | Inspect file size, MIME type, timestamps without downloading |
| Address Validation | `avfs validate <address>` | Syntax check against AVFS v1 grammar rules |
| Plugin Management | `avfs plugin list/load/unregister` | Manage custom protocol drivers |

### 12.3 Skill Architecture

The SKILL acts as a declarative instruction layer above the CLI:

```
AI Agent → loads SKILL.md → understands AVFS protocol & CLI
    → receives user file reference
    → decides: validate? convert? fetch? stat?
    → executes appropriate avfs CLI command
    → returns content / metadata / converted address to user
```

The SKILL includes a decision flowchart, protocol-specific conversion rules, error handling guidance, and common recipe patterns (cross-storage cross-reference, batch processing, multi-version Git comparison).

### 12.4 Usage

Load the SKILL into any AI Agent platform by referencing `skills/avfs-skill/SKILL.md` as a context document. The agent can then:

- Automatically recognize `avfs://` URIs in user input
- Convert any file reference (local path, URL, UNC path, Git URL) to/from AVFS format
- Fetch and process file content from any registered storage backend
- Validate address syntax before passing to downstream tools

---

## 13. License Statement

This protocol specification and corresponding implementation code are open sourced under Apache License 2.0.

- Allow personal learning, commercial integration, code modification and secondary development
- All modified content shall be explicitly marked with change description
- The license contains inherent patent usage authorization, protecting legitimate rights of all adopters

Full license text is stored in project root [`LICENSE`](../LICENSE) file.

---

## 14. Related Links

| Link | URL |
|------|-----|
| Official Website | https://avfs.io |
| GitHub Organization | https://github.com/avfs-io |
| Parent ASDM Project | https://asdm.ai |
