# CLI

Command-line tool for AVFS address operations, resource fetching, and plugin management.

## Tech Stack (v1)

| Item | Choice | Notes |
|------|--------|-------|
| **Language** | TypeScript | Strict mode, target ES2022 |
| **Runtime** | Node.js >= 18 | LTS required |
| **Package Manager** | npm | Published as `@avfs/cli` |
| **CLI Framework** | [commander](https://github.com/tj/commander.js) | Argument parsing & sub-command dispatch |
| **Build Tool** | [tsup](https://github.com/egoist/tsup) | Bundle into single ESM + CJS entry |
| **Cross-Platform** | [pkg](https://github.com/vercel/pkg) or **@napi-rs/cli** (preferred) | Native binaries for linux/macos/win (x64 + arm64) |

### Distribution Plan

- **npm package** (`@avfs/cli`): ESM/CJS dual-package, install via `npm i -g @avfs/cli`
- **Standalone binaries**: Pre-built executables for each platform/arch from GitHub Releases
- **Install script**: `curl -sL https://get.avfs.io | bash` for quick setup

## Overview

Lightweight CLI utility for daily AVFS resource management. Provides quick one-command access to fetch, convert, inspect, and manage AVFS-addressed resources from any terminal.

## Usage

```bash
avfs [command] [options] <avfs-address>
```

## Commands (Planned)

| Command | Alias | Description | Example |
|---------|-------|-------------|---------|
| `fetch` | `f` | Download resource to local disk | `avfs fetch avfs://git/github.com/avfs-io/core@main/readme.md -o readme.md` |
| `convert` | `c` | Convert between native path/URL and AVFS address | `avfs convert "D:\work\app.bin" --to-avfs` |
| `stat` | `s` | Inspect resource metadata | `avfs stat avfs://file/home/system/release/app.bin` |
| `validate` | `v` | Check AVFS address syntax validity | `avfs validate avfs://smb/192.168.1.60/share/doc.pdf` |
| `plugin` | `p` | Sub-commands for plugin management | `avfs plugin list` / `avfs plugin load ./oss.so` |
| `help` | `h` | Show help information | `avfs help fetch` |
| `version` | `V` | Print CLI and core version | `avfs --version` |

## Global Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output` | `-o` | Set local output file path for fetch command |
| `--to-avfs` | | Convert native path to AVFS format |
| `--to-native` | | Convert AVFS address back to native format |
| `--verbose` | `-v` | Enable detailed debug logging |
| `--quiet` | `-q` | Silent mode, suppress non-error output |
| `--config` | `-c` | Specify custom config file path |
| `--no-color` | | Disable colored output |

## Architecture

```
CLI Entry Point (arg parsing)
        ↓
   Command Dispatcher
        ↓
   ┌────┼────┬────┬────┬────┐
   ↓    ↓    ↓    ↓    ↓    ↓
 fetch convert stat validate plugin help
   ↓    ↓    ↓    ↓    ↓
   └────┴────┴────┴────┘
              ↓
        Core Engine (parser, router, registry, converter)
              ↓
        Driver Plugins (file/http/https/smb/git/custom)
```

## Config File (Planned)

Default location: `~/.avfs/config.toml` or project-level `.avfsrc`

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
auth-token = "${GIT_TOKEN}"  # env var expansion supported
```

## Dependencies

- [Core](../core/README.md) — Core engine invoked by every command
- [SDK](../sdk/README.md) — TypeScript SDK used internally
- [Driver](../driver/README.md) — Built-in drivers loaded by default
- [Plugin SDK](../plugin-sdk/README.md) — Dynamic plugin loading mechanism

## Directory Structure (Planned)

```
cli/
├── README.md                  # This file
├── package.json               # Package manifest (name: @avfs/cli, bin: avfs)
├── tsconfig.json              # TypeScript config (strict, ES2022, NodeNext)
├── tsup.config.ts             # Bundle config (dual ESM/CJS output)
│
├── src/
│   ├── index.ts               # Entry point — creates Commander program, registers commands
│   ├── cli.ts                 # Bootstrap logic, version check, error handling
│   │
│   ├── commands/              # One module per command
│   │   ├── fetch.command.ts   # avfs fetch <address> [-o path]
│   │   ├── convert.command.ts # avfs convert <path> --to-avfs|--to-native
│   │   ├── stat.command.ts    # avfs stat <address>
│   │   ├── validate.command.ts# avfs validate <address>
│   │   ├── plugin.command.ts  # avfs plugin list|load|unload
│   │   └── index.ts           # Auto-register all commands
│   │
│   ├── lib/                   # Shared utilities for CLI layer only
│   │   ├── logger.ts          # Console output formatting (table, spinner, color)
│   │   ├── config.ts          # Config file loader (~/.avfs/config.toml, .avfsrc)
│   │   ├── formatter.ts       # Output format: text | json | table
│   │   └── error.ts           # CLI error codes & pretty-print handler
│   │
│   └── types/                 # CLI-specific type definitions
│       └── index.ts           # CommandContext, CliConfig, OutputFormat, etc.
│
├── test/
│   ├── commands/              # Unit tests per command
│   ├── lib/                   # Tests for logger, config, formatter
│   └── fixtures/              # Sample config files, mock addresses
│
└── scripts/
    ├── build.ts               # Build + optional binary packaging
    └── postinstall.ts         # Post-install checks / setup wizard (future)
```
