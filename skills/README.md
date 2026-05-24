# AVFS Skills

This directory contains reusable SKILL definitions that teach AI Agents how to use the AVFS protocol and CLI as a wrapper, enabling automatic address recognition, conversion, resource fetching, and more.

## Available Skills

| Skill | Description |
|-------|-------------|
| [`avfs-skill`](./avfs-skill/SKILL.md) | **Default AVFS skill** — teaches AI Agents to use the `avfs` CLI for address parsing, bidirectional conversion, content fetching, validation, and plugin management across all storage backends (file, HTTP/S, SMB, Git, custom). |

## What is a SKILL?

A SKILL is a markdown document (`SKILL.md`) that provides an AI Agent with structured knowledge and procedural workflows for a specific domain. It acts as a wrapper — the agent reads the SKILL, understands the available commands, and translates user intents into proper tool invocations.

## How to Use

### As an AI Agent User

When using any AI Agent platform (CodeBuddy, Cursor, Claude Code, etc.), you can load the AVFS skill to give the agent automatic AVFS capabilities:

1. **Point the agent to the SKILL file** as a context document
2. **Reference the skill** in your prompt, e.g.:
   > "Use the avfs-skill to convert `github.com/team/repo@main/docs/api.md` to an AVFS address and fetch its content"

The agent will then follow the workflows defined in `SKILL.md` to:
- Recognize `avfs://` addresses
- Convert between native paths/URLs and AVFS format
- Fetch and read resource content via the `avfs` CLI

### Adding Custom Skills

To create a new skill for a custom protocol or workflow:

1. Create a new directory under `skills/` (e.g., `skills/my-protocol-skill/`)
2. Add a `SKILL.md` file following the same structure as `avfs-skill`
3. Document the custom protocol, its address format, conversion rules, and CLI usage

## Skill Structure

Each skill directory contains:

```
skills/<skill-name>/
├── SKILL.md          # Main skill document (required)
└── ...               # Additional assets, examples, scripts (optional)
```

The `SKILL.md` should cover:
- **Overview**: What the skill enables
- **Prerequisites**: Required tools and installation
- **Core Workflows**: Step-by-step procedures for common tasks
- **Common Patterns**: Recipes combining multiple commands
- **Error Handling**: Common issues and resolutions
- **Quick Reference**: Command cheat sheet
