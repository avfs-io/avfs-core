# Core

Core engine providing address parsing, path normalization, routing scheduler, and plugin registry.

## Responsibilities

| Module | Description | Status |
|--------|-------------|--------|
| `parser` | Parse `avfs://` addresses into structured components (proto, resource-base, version, file-path, anchor) | Planned |
| `normalizer` | Path normalization: resolve `./`, `../`, handle edge cases across protocols | Planned |
| `router` | Route parsed addresses to matched driver plugins via protocol registry | Planned |
| `registry` | Protocol-to-driver mapping registry with register/unregister/list operations | Planned |
| `converter` | Bidirectional converter: native path/URL ↔ AVFS address | Planned |
| `validator` | Validate AVFS address syntax against official spec | Planned |

## Architecture

```
AI Agent Invoke
       ↓
  ┌─────────────┐
  │   Parser     │ → Split protocol, base, version, path, anchor
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │ Normalizer  │ → Resolve relative paths, canonical form
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │  Validator  │ → Check syntax compliance
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │   Router     │ → Match protocol → dispatch to driver
  └──────┬──────┘
         ↓
  ┌─────────────┐
  │  Registry    │ → Protocol ↔ Driver lookup table
  └─────────────┘
```

## Dependencies

- [Spec](../spec/README.md) — Protocol specification this core implements
- [Driver](../driver/README.md) — Built-in driver plugins registered here

## Related

- [Plugin SDK](../plugin-sdk/README.md) — Interface definition for pluggable drivers
- [CLI](../cli/README.md) — Command-line tool that wraps core functionality
