# AVFS (Agent Virtual File System)
**Universal Cross-Storage Addressing Protocol for AI Agents**
Unify local disk, network service, LAN share, Git repositories into one consistent `avfs://` addressing standard.

Official Site: [https://avfs.io](https://avfs.io)
GitHub Organization: [https://github.com/avfs-io](https://github.com/avfs-io)

## Overview
AVFS is a universal virtual file system protocol designed for AI Agents.
It eliminates access differences across heterogeneous storage resources, provides a single standardized address specification, and enables agents to locate, fetch and manage **any file resource** in unified logic.

No limitation on file format, storage vendor, network environment or deployment architecture. All resources can be accessed, referenced and traced through one set of rules.

## Core Features
- **Single unified protocol**
  5 built-in access types integrated: `file`, `http`, `https`, `smb`, `git`
- **Full file format support**
  Transparent raw binary stream transmission, compatible with text, office document, image, video, archive, binary executable and all custom file types
- **Extensible Protocol-Driver Plugin System**
  One-to-one mapping between protocol identifier and access driver, support custom protocol extension
- **Multi-vendor Git compatibility**
  Natively support GitHub, GitLab, Gitee, Azure DevOps, Bitbucket and private self-hosted Git services
- **Version-level precise positioning**
  Access file snapshot by branch, tag and commit hash
- **Fine-grained content anchor**
  Locate specific line or content section inside file
- **Relative path native resolution**
  Automatically resolve `./` current directory and `../` parent directory path logic
- **Lossless bidirectional conversion**
  Seamlessly convert between original system path, network URL and AVFS address
- **Agent-oriented design**
  Structured machine-readable address, easy to parse, route and automate by intelligent agents
- **Practical CLI Tool**
  Command-line utility for quick fetch, convert, inspect and manage AVFS resources

## Plugin & Driver Architecture
AVFS adopts **Protocol-Driver matched plugin mechanism**
Each unique protocol identifier binds to an independent driver plugin.
Core system maintains a protocol registry, dispatching access requests to corresponding plugin implementation.

### Core Matching Rule
`Protocol Name <--> Access Driver Plugin`
- Built-in official plugins
  - `file` → Local filesystem IO driver
  - `http` → Plain HTTP network request driver
  - `https` → Encrypted HTTPS secure fetch driver
  - `smb` → LAN shared storage access driver
  - `git` → Versioned Git repository retrieval driver
- Custom extension capability
  Developers can register new protocol identifiers and implement customized driver plugins, to adapt private storage, proprietary service and customized transmission protocol.

### Plugin Lifecycle
1. Protocol register: Bind custom protocol string with self-developed driver
2. Address routing: Parser matches protocol and dispatch request to target plugin
3. Resource processing: Driver completes connection, authentication, data reading and metadata returning
4. Unregister & hot swap: Support dynamic plugin management without restarting core service

## Protocol Standard Syntax
```
avfs://<proto>/<resource-base>@<version>/<file-path>[#anchor]
```

### Field Definition
| Field | Description | Applicable Scope |
|-------|-------------|------------------|
| `proto` | Resource access protocol, matched with registered driver plugin | All resources, support custom extended protocol |
| `resource-base` | Disk location, network host, complete original repository path | All resources, retain native structure of Git vendors |
| `@version` | Version identifier for Git: branch name / tag / commit hash | Git exclusive, omitted for other protocols |
| `file-path` | Inner file directory path, support standard relative path rule | All resources |
| `#anchor` | Content positioning marker: line number `Lxx` or section anchor | All resources |

## Address Examples
### Local File System
Covers all local disk files without format restriction
```
avfs://file/d/work/service/config.json
avfs://file/home/system/release/app.bin
avfs://file/opt/data/report.pdf
avfs://file/../static/cover.png
```

### HTTP Intranet Resource
```
avfs://http/192.168.3.20:8090/service/rule.yaml
avfs://http/inner.server/api/dataset.csv
```

### HTTPS Public Cloud Resource
```
avfs://https/avfs.io/spec/avfs-v1-standard.pdf
avfs://https://cdn.avfs.io/package/setup.zip
```

### SMB LAN Shared Storage
```
avfs://smb/192.168.1.60/share/business/record.xlsx
avfs://smb/office.host/public/media/demo.mp4
```

### Multi-Vendor Git Repository
Adapt irregular path structure of different Git platforms, no forced path restructuring

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

### Custom Extended Protocol Example
After registering custom protocol and driver, new resource type can be accessed uniformly
```
avfs://oss/bucket-name/object/data.backup
avfs://ftp/10.0.0.5/pub/package.iso
```

### Content Anchor Positioning
Accurately target partial content inside complete file
```
avfs://file/log/runtime.log#L120
avfs://git/github.com/avfs-io/spec@main/architecture.md#core-routing
```

## Full Binary Stream Compatibility
AVFS routing layer only completes location and resource scheduling, **never modify original binary data and file header information**.

- Original file bytes, signature header and metadata remain completely unchanged after fetching
- Uniform identification mechanism: filename suffix matching + binary header signature detection
- Support all mainstream and custom file extensions
- Consistent file integrity across different access protocols

Supported full file categories:
Text source file, office document, raster/vector image, audio video, compressed package, system binary, firmware, database backup, custom format file.

## Path Resolution Mechanism
Take current accessed resource base address as virtual working directory, automatically calculate relative path reference:
- `./` resolve to same directory sibling resource
- `../` roll back to upper level directory
Path logic keeps unified across local, intranet, public network and Git repository.

## Runtime Architecture
```
AI Agent Invoke
        ↓
AVFS Address Parser
Split protocol, base resource, version, file path and anchor
        ↓
Protocol Plugin Registry
Match registered protocol & dispatch to corresponding driver
        ↓
Matched Driver Plugin
├─ file → Local filesystem IO access
├─ http → Plain text network request
├─ https → Encrypted secure network fetch
├─ smb → LAN shared directory access client
├─ git → Versioned repository file retrieval
└─ Custom Plugin → User-defined private storage access
        ↓
Return complete raw binary stream + resource metadata
        ↓
Upper business layer process, parse or persist file content
```

## Bidirectional Address Conversion
Lossless mapping between original access address and AVFS standard address
- Local file path ↔ `avfs://file/`
- HTTP/HTTPS URL ↔ `avfs://http/` / `avfs://https/`
- SMB shared path ↔ `avfs://smb/`
- Git repository original address ↔ `avfs://git/` with version lock
- Custom storage path ↔ Self-defined protocol address

## CLI Usage Guide
AVFS provides lightweight command-line tool for daily resource operation, address conversion and plugin management.

### Basic Command Format
```bash
avfs [command] [options] <avfs-address>
```

### 1. Fetch Resource
Download and save remote/virtual resource to local disk
```bash
# Fetch local virtual file
avfs fetch avfs://file/d/work/config.json -o ./local-save/config.json

# Fetch intranet HTTP resource
avfs fetch avfs://http/192.168.3.20:8090/service/rule.yaml -o rule.yaml

# Fetch specified Git version file
avfs fetch avfs://git/github.com/avfs-io/core@v1.0.0/readme.md -o avfs-readme.md

# Fetch binary package
avfs fetch avfs://https/cdn.avfs.io/package/setup.zip -o setup.zip
```

### 2. Address Conversion
Convert native path/URL to standard AVFS address, reverse conversion supported
```bash
# Original local path to AVFS
avfs convert "D:\work\app.bin" --to-avfs

# HTTPS URL convert to AVFS
avfs convert "https://avfs.io/spec/standard.pdf" --to-avfs

# AVFS convert back to native original address
avfs convert avfs://smb/192.168.1.60/share/record.xlsx --to-native
```

### 3. Inspect Resource Metadata
Check file type, size, protocol info and file header signature
```bash
avfs stat avfs://git/github.com/avfs-io/core@main/driver/git.go
avfs stat avfs://file/home/system/release/app.bin
```

### 4. Plugin Management
Register, list and reload extended protocol drivers
```bash
# List all loaded protocol plugins
avfs plugin list

# Load custom driver plugin
avfs plugin load ./plugins/oss-driver.so

# Unregister unused protocol
avfs plugin unregister oss
```

### 5. Validate Address Syntax
Check whether AVFS address complies with standard specification
```bash
avfs validate avfs://git/dev.azure.com/team/org/_git/service@main/src/entry.jar
```

### Common CLI Options
| Option | Description |
|--------|-------------|
| `-o, --output` | Set local output save path |
| `--to-avfs` | Convert original path to AVFS format |
| `--to-native` | Convert AVFS address back to native access path |
| `-v, --verbose` | Print detailed running log |
| `-q, --quiet` | Silent output mode |

## Repository Structure
```
avfs-io
├── spec          # Official AVFS protocol specification document
├── core          # Address parsing, path normalization, routing scheduler, plugin registry
├── driver        # Built-in five category official access drivers
├── plugin-sdk    # Development SDK for custom protocol & driver extension
├── sdk           # Multi-language official development SDK
├── cli           # Command line address tool and resource fetcher
├── examples      # Full-scenario cross-storage usage samples & custom plugin demo
└── docs          # Official website static resource source
```

## Plugin Extension Development
1. Define exclusive custom protocol identifier, avoid conflict with built-in protocols
2. Implement standard driver interface, realize connect, read, stat basic methods
3. Register driver instance to AVFS core plugin registry
4. Access extended resources via new `avfs://custom-proto/` address format

## Design Value
- Build global unified resource namespace for AI agent scheduling, memory management and knowledge retrieval
- Solve path confusion, resource missing and version inconsistency in cross-environment collaboration
- Shield underlying storage difference, agent focuses only business logic without caring access mode
- Loose-coupled plugin design, flexible access capability expansion, adapt diverse enterprise private storage
- Open standard protocol, compatible with existing massive legacy resources, low migration cost

## License
This project is open sourced under **Apache License 2.0**.

Permitted usage includes personal study, commercial integration, code modification and secondary development.
All modifications to source code and protocol implementation shall be explicitly stated.
This license contains inherent patent authorization, protecting legitimate usage rights of adopters.

Full license text is available in the `LICENSE` file of repository root directory.

## Links
Official Website: https://avfs.io
GitHub Organization: https://github.com/avfs-io

---
**Sub-project under ASDM**
https://asdm.ai