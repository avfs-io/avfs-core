# Examples

Full-scenario cross-storage usage samples and custom plugin development demos.

## Categories

### 1. Basic Usage (`basic/`)

Fundamental AVFS operations for beginners.

| Example | Description | Status |
|---------|-------------|--------|
| `fetch-local.md` | Fetch a local file via `avfs://file/` protocol | Planned |
| `fetch-http.md` | Fetch an intranet HTTP YAML config | Planned |
| `fetch-https.md` | Download a public cloud package | Planned |
| `fetch-smb.md` | Read a LAN shared Excel file | Planned |
| `fetch-git-github.md` | Retrieve a specific GitHub file at a tag version | Planned |
| `fetch-git-gitlab.md` | Retrieve a GitLab repository file | Planned |
| `convert-roundtrip.md` | Full round-trip conversion demo (native ↔ AVFS ↔ native) | Planned |
| `anchor-lines.md` | Content anchoring by line number | Planned |
| `anchor-section.md` | Content anchoring by section heading | Planned |

### 2. Advanced Scenarios (`advanced/`)

Real-world cross-environment usage patterns.

| Example | Description | Status |
|---------|-------------|--------|
| `multi-source-pipeline.md` | Chain multiple AVFS sources in a data pipeline | Planned |
| `batch-fetch.md` | Bulk download from mixed protocols | Planned |
| `git-version-compare.md` | Compare the same file across branches/tags/commits | Planned |
| `custom-auth.md` | Authentication configuration for private repos and SMB shares | Planned |
| `error-handling.md` | Graceful handling of network failures and missing resources | Planned |
| `relative-path-resolution.md` | Complex relative path traversal demos | Planned |

### 3. Custom Plugin Development (`plugins/`)

Step-by-step guides for writing your own protocol driver.

| Example | Description | Status |
|---------|-------------|--------|
| `hello-world-plugin.md` | Minimal working custom protocol driver (echo/dummy) | Planned |
| `oss-driver.md` | Full OSS (Object Storage Service) driver implementation | Planned |
| `s3-driver.md` | AWS S3 compatible driver with presigned URL support | Planned |
| `ftp-driver.md` | Legacy FTP server driver example | Planned |
| `redis-driver.md` | Key-value store as virtual filesystem | Planned |
| `cache-middleware.md` | Write a middleware plugin for response caching | Planned |
| `logging-hook.md` | Lifecycle hook plugin for audit logging | Planned |

### 4. Integration Demos (`integration/`)

Integrate AVFS with popular frameworks and tools.

| Example | Description | Status |
|---------|-------------|--------|
| `ai-agent-consumer.md` | How an AI Agent uses AVFS to locate and fetch resources | Planned |
| `ci-cd-pipeline.md` | Use AVFS in CI/CD to pull configs from Git/SMB/HTTP | Planned |
| `docker-volume.md` | AVFS-backed Docker volume driver concept | Planned |
| `vscode-extension.md` | VS Code extension using AVFS for remote file access | Planned |

## Running Examples

Each example is self-contained and includes:
1. **Prerequisites** — Required tools or setup
2. **Step-by-step commands** — Copy-paste ready
3. **Expected output** — What you should see
4. **Explanation** — Why it works

> Note: Most examples require the AVFS CLI to be installed. See [CLI](../cli/README.md) for setup instructions.

## Dependencies

- [CLI](../cli/README.md) — CLI tool used by all examples
- [Plugin SDK](../plugin-sdk/README.md) — For custom plugin examples
- [Spec](../spec/README.md) — Protocol spec referenced throughout examples
