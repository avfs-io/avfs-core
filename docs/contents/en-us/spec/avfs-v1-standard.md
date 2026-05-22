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
10. [Project Directory Structure](#10-project-directory-structure)
11. [License Statement](#11-license-statement)
12. [Related Links](#12-related-links)

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
avfs://<proto>/<resource-base>@<version>/<file-path>[#anchor]
```

### 3.2 Field Definition

| Field | Mandatory | Description | Applicable Scope |
|-------|-----------|-------------|------------------|
| `proto` | Yes | Resource access protocol identifier, bound with registered driver | All resources, support custom extension |
| `resource-base` | Yes | Disk location, network host, complete original repository path, retain vendor native structure | All resources |
| `@version` | No | Version mark: branch / tag / commit hash | Only valid for Git protocol, omitted otherwise |
| `file-path` | Yes | Inner directory file path, support standard relative path rule | All resources |
| `#anchor` | No | Fine positioning mark: line number Lxx or section anchor | All resources |

### 3.3 Syntax Constraint Rules

- Only single `@` symbol allowed in one address, exclusively used for Git version separation, no nested duplicate mark
- Non-Git protocol automatically ignore version field, no parsing error
- Relative path `./` and `../` keep unified resolution logic across all resources
- Anchor mark only locates internal content, does not change original file resource path

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
avfs://git/github.com/avfs-io/core@dev/driver/smb.client
avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh
avfs://git/github.com/avfs-io/core@9a27c1f/module/kernel.so
```

**Azure DevOps**

```
avfs://git/dev.azure.com/team/org/_git/service@main/src/entry.jar
avfs://git/dev.azure.com/team/org/_git/platform@hotfix/util/check.dll
```

**Self-hosted Git & Bitbucket**

```
avfs://git/git.company.internal/ai/group/engine@release/doc/design.vsdx
avfs://git/bitbucket.org/team/avfs-runtime@main/conf/env.ini
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
avfs://git/github.com/avfs-io/spec@main/architecture.md#core-routing
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
avfs fetch <avfs-address> -o <local-save-path>
```

#### 8.2.2 Address Conversion

```bash
avfs convert [source-path] --to-avfs
avfs convert [avfs-address] --to-native
```

#### 8.2.3 Resource Metadata Inspection

```bash
avfs stat <avfs-address>
```

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

### 8.3 General Options

| Option | Function |
|--------|----------|
| `-o, --output` | Specify local output saving path |
| `-v, --verbose` | Output detailed running log |
| `-q, --quiet` | Silent mode, minimize output |

---

## 9. Plugin Extension Development Specification

- Define exclusive custom protocol identifier, avoid conflict with built-in protocol
- Implement unified driver interface, complete connect, read, stat basic methods
- Register developed driver into AVFS core protocol registry
- Access extended resource via new customized AVFS address format

---

## 10. Project Directory Structure

```
avfs-io
├── spec          # AVFS official protocol specification document
├── core          # Address parser, path normalization, routing scheduler, plugin registry
├── driver        # Built-in five official access drivers
├── plugin-sdk    # Custom protocol & driver development SDK
├── sdk           # Multi-language official development SDK
├── cli           # Command line tool source code
├── examples      # Full-scenario usage & custom plugin demo
└── docs          # Official website static resource source
```

---

## 11. License Statement

This protocol specification and corresponding implementation code are open sourced under Apache License 2.0.

- Allow personal learning, commercial integration, code modification and secondary development
- All modified content shall be explicitly marked with change description
- The license contains inherent patent usage authorization, protecting legitimate rights of all adopters

Full license text is stored in project root [`LICENSE`](../LICENSE) file.

---

## 12. Related Links

| Link | URL |
|------|-----|
| Official Website | https://avfs.io |
| GitHub Organization | https://github.com/avfs-io |
| Parent ASDM Project | https://asdm.ai |
