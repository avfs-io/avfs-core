# SDK

Multi-language official development SDK for AVFS integration.

## Overview

This directory provides official client libraries for integrating AVFS into applications written in different programming languages. Each SDK wraps the core AVFS engine operations behind idiomatic language APIs.

## Supported Languages (Planned)

| Language | Package Name | Status | Features |
|----------|-------------|--------|----------|
| TypeScript / JavaScript | `@avfs/sdk` | Planned | Fetch, convert, validate, stat, plugin management |
| Python | `avfs-sdk` | Planned | Async/sync API, context manager, type hints |
| Go | `github.com/avfs-io/go-sdk` | Planned | Concurrent-safe, streaming, error wrapping |
| Rust | `avfs` | Planned | Zero-copy, async, trait-based abstraction |
| Java / Kotlin | `io.avfs:avfs-sdk` | Planned | JVM integration, Spring Boot adapter |
| C# / .NET | `Avfs.Sdk` | Planned | .NET Standard, async/await, DI support |

## Common API Surface (Across All Languages)

| Method | Signature | Description |
|--------|-----------|-------------|
| `fetch(address, options?)` | `address: string → Stream` | Download resource to local file or memory stream |
| `convert(pathOrUrl, direction)` | `string, "to-avfs"|"to-native" → string` | Bidirectional address conversion |
| `validate(address)` | `address: string → ValidationResult` | Syntax validation with detailed errors |
| `stat(address)` | `address: string → Metadata` | File metadata inspection (type, size, modified, etc.) |
| `plugin.list()` | `→ PluginInfo[]` | List all registered protocol drivers |
| `plugin.load(pluginPath)` | `path: string → void` | Load custom driver plugin |

## Language-Specific Notes

### TypeScript / JavaScript

```bash
npm install @avfs/sdk
```

### Python

```bash
pip install avfs-sdk
```

### Go

```bash
go get github.com/avfs-io/go-sdk
```

## Dependencies

- [Core](../core/README.md) — Underlying engine each SDK wraps
- [CLI](../cli/README.md) — CLI tool uses same SDK internally
- [Spec](../spec/README.md) — Protocol spec all SDKs conform to
