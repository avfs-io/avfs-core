# Docs

Official website static resource source and documentation materials.

## Contents

This directory contains the source for the AVFS official website and supplementary documentation not covered by the codebase specs.

| Item | Description | Status |
|------|-------------|--------|
| `site/` | Official website (https://avfs.io) static site source | Planned |
| `blog/` | Blog post markdown sources | Planned |
| `tutorials/` | Step-by-step tutorial articles (beyond basic examples) | Planned |
| `api-reference/` | Auto-generated API reference documentation | Planned |
| `changelog/` | Version history and release notes | Planned |
| `assets/` | Images, diagrams, logos, and other media assets | Planned |
| `contributing/` | Contribution guidelines, code of conduct, governance | Planned |

## Website Structure (Planned)

```
docs/site/
├── index.html              # Landing page
├── getting-started/
│   ├── installation.html
│   ├── quick-start.html
│   └── first-fetch.html
├── guide/
│   ├── address-format.html
│   ├── built-in-drivers.html
│   ├── custom-plugins.html
│   ├── cli-reference.html
│   └── sdk-integration.html
├── spec/
│   ├── protocol-v1.html          # Rendered from ../spec/
│   └── driver-interface.html
├── community/
│   ├── examples.html             # Links to ../examples/
│   └── ecosystem.html
└── about/
    ├── license.html
    ├── team.html
    └── roadmap.html
```

## Documentation Principles

1. **Code-first** — Every doc page includes runnable code snippets
2. **Multi-language** — All docs available in English (primary), Chinese, Japanese
3. **Versioned** — Documentation tagged per release version
4. **Open contribution** — Community PRs welcome for docs improvements

## Dependencies

- [Spec](../spec/README.md) — Technical specifications rendered on website
- [Examples](../examples/README.md) — Tutorials and demos linked from docs
- [SDK](../sdk/README.md) — SDK API reference auto-generated from source
