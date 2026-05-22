# AVFS Documentation

> **English** | [中文](README_CN.md)

Official documentation source for the AVFS project.

## Structure

```
docs/
├── README.md                    # This file
├── contents/
│   ├── en-us/
│   │   └── spec/                # English specifications (6 files)
│   │       ├── README.md        # Index & examples
│   │       ├── avfs-v1-standard.md
│   │       ├── address-syntax.md
│   │       ├── driver-interface.md
│   │       ├── plugin-lifecycle.md
│   │       └── conversion-rules.md
│   └── zh-cn/
│       └── spec/                # Chinese specifications (6 files)
│           ├── README.md        # Index & examples
│           ├── avfs-v1-standard.md
│           ├── address-syntax.md
│           ├── driver-interface.md
│           ├── plugin-lifecycle.md
│           └── conversion-rules.md
```

## Specifications (`contents/*/spec/`)

| Document | Description |
|----------|-------------|
| **avfs-v1-standard** | Complete AVFS protocol specification v1.0 |
| **address-syntax** | Address format grammar with ABNF definition |
| **driver-interface** | Plugin interface contract & API |
| **plugin-lifecycle** | Plugin state machine & lifecycle management |
| **conversion-rules** | Bidirectional address conversion rules |

### Language Links

- **[English (en-us)](./contents/en-us/spec/README.md)** — Primary language, RFC-compliant
- **[中文 (zh-cn)](./contents/zh-cn/spec/README.md)** — Chinese translation

## Documentation Principles

1. **Code-first** — Every doc page includes runnable code snippets
2. **Multi-language** — All specs available in English (primary) and Chinese; extensible for more languages via `contents/{locale}/`
3. **Versioned** — Documentation tagged per release version
4. **Open contribution** — Community PRs welcome for docs improvements

## Planned Additions

| Item | Description | Status |
|------|-------------|--------|
| `tutorials/` | Step-by-step tutorial articles | Planned |
| `api-reference/` | Auto-generated API reference documentation | Planned |

> **Note**: The official website (https://avfs.io) is maintained in a [separate repository](https://github.com/avfs-io/avfs-site).

## Dependencies

- **[Spec](./contents/en-us/spec/README.md)** — Technical specifications (migrated from root `spec/`)
- **[Examples](../examples/README.md)** — Tutorials and demos linked from docs
- **[SDK](../sdk/README.md)** — SDK API reference auto-generated from source
