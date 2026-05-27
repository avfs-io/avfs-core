# Spec

Official AVFS protocol specification documents.

## Contents

This directory contains the authoritative definition of the AVFS protocol standard, including:

| Document | Description | Status |
|----------|-------------|--------|
| [**avfs-v1-standard.md**](./avfs-v1-standard.md) | Complete AVFS v1.0 protocol specification (architecture, syntax, semantics, CLI, examples) | Draft |
| [**address-syntax.md**](./address-syntax.md) | Detailed address format grammar, ABNF, field definitions, parsing & normalization | Draft |
| [**driver-interface.md**](./driver-interface.md) | Official driver plugin interface contract, type definitions, error types, registration API | Draft |
| [**plugin-lifecycle.md**](./plugin-lifecycle.md) | Plugin state machine, registration/routing/process/manage phases, event system, security | Draft |
| [**conversion-rules.md**](./conversion-rules.md) | Bidirectional address conversion rules for file/HTTP/SMB/Git/custom protocols with full examples | Draft |
| [**authentication.md**](./authentication.md) | Credential store model, resolution, sources, driver auth contract, security requirements | Draft |
| [**avfs-skill**](../../../../skills/avfs-skill/SKILL.md) | AI Agent SKILL — teaches AI Agents to use `avfs` CLI for address recognition, conversion, and content retrieval | Active |

## Quick Start

1. **Read the main spec**: [`avfs-v1-standard.md`](./avfs-v1-standard.md) for the complete v1.0 protocol definition
2. **Deep-dive into syntax**: [`address-syntax.md`](./address-syntax.md) for grammar details and edge cases
3. **Implement a driver**: [`driver-interface.md`](./driver-interface.md) for the interface contract you must implement
4. **Understand lifecycle**: [`plugin-lifecycle.md`](./plugin-lifecycle.md) for how plugins are managed at runtime
5. **Handle conversions**: [`conversion-rules.md`](./conversion-rules.md) for native↔AVFS mapping algorithms
6. **Configure authentication**: [`authentication.md`](./authentication.md) for credential management and driver auth

## Purpose

The spec serves as the single source of truth for:

- Protocol syntax and semantic rules
- Driver plugin interface contracts
- Address conversion algorithms
- Extension development guidelines

All driver implementations and SDK bindings must conform to the specifications defined here.

## Related

- [Core](../../../../core/README.md) — Reference implementation of this spec
- [Plugin SDK](../../../../plugin-sdk/README.md) — SDK for implementing custom drivers per this spec
- **AVFS Official Site**: https://avfs.io
- **GitHub**: https://github.com/avfs-io
- **License**: Apache License 2.0 ([`LICENSE`](../../../../LICENSE))

## Other Languages

- **中文版 (zh-cn)**: [../zh-cn/spec/README.md](../zh-cn/spec/README.md)

Below are the same resources expressed in `avfs://` standard address format:

### Local File System (`avfs://file/`)

| Resource | AVFS Address |
|----------|-------------|
| This index | `avfs://file/spec/README.md` |
| Main specification | `avfs://file/spec/avfs-v1-standard.md` |
| Address syntax grammar | `avfs://file/spec/address-syntax.md` |
| Driver interface contract | `avfs://file/spec/driver-interface.md` |
| Plugin lifecycle spec | `avfs://file/spec/plugin-lifecycle.md` |
| Conversion rules | `avfs://file/spec/conversion-rules.md` |
| Core implementation | `avfs://file/core/README.md` |
| Plugin SDK | `avfs://file/plugin-sdk/README.md` |
| Project LICENSE | `avfs://file/LICENSE` |

### Git Repository (`avfs://git/`)

| Resource | AVFS Address |
|----------|-------------|
| GitHub repo root | `avfs://git/github.com/avfs-io/avfs-core` |
| This README on main | `avfs://git/github.com/avfs-io/avfs-core/spec/README.md?ref=main` |
| Main spec on main branch | `avfs://git/github.com/avfs-io/avfs-core/spec/avfs-v1-standard.md?ref=main#introduction` |
| Address syntax doc | `avfs://git/github.com/avfs-io/avfs-core/spec/address-syntax.md?ref=main#full-syntax-grammar` |
| Driver interface doc | `avfs://git/github.com/avfs-io/avfs-core/spec/driver-interface.md?ref=main#interface-overview` |
| Parent ASDM project | `avfs://git/github.com/avfs-io/asdm` |
