# AVFS Address Bidirectional Conversion Rules

> Part of [AVFS v1 Standard](./avfs-v1-standard.md) — Lossless conversion between native paths/URLs and AVFS standard addresses.

## 1. Conversion Principles

All conversions follow these core principles:

1. **Lossless round-trip**: `native → avfs → native` yields identical result
2. **No data loss**: All information in source address preserved in target format
3. **Deterministic**: Same input always produces same output
4. **Normalizable**: Output conforms to normalized AVFS syntax rules

## 2. Local Path ↔ AVFS

### 2.1 Local Path → AVFS (`toAvfs`)

**Algorithm**:
1. Resolve absolute path (resolve symlinks, `..`, `.`)
2. Prepend `avfs://file/`
3. Normalize path separators to `/`

**Examples**:

| Native Path (Unix) | AVFS Address |
|-------------------|--------------|
| `/home/user/config.json` | `avfs://file/home/user/config.json` |
| `d:/work/service/app.yaml` | `avfs://file/d/work/service/app.yaml` |
| `../../static/image.png` | `avfs://file/static/image.png` |
| `/opt/data/../report.pdf` | `avfs://file/opt/report.pdf` |

**Edge Cases**:

| Input | Handling |
|-------|----------|
| Relative path | Resolve against CWD first |
| Symlink | Follow symlink, use resolved real path |
| Path with spaces | Preserve as-is (no encoding needed for `file:`) |
| Non-existent path | Still produce valid AVFS address (existence not required) |
| Root path `/` | `avfs://file/` (empty file-path, represents root) |

### 2.2 AVFS → Local Path (`toNative`)

**Algorithm**:
1. Verify `protocol === 'file'`
2. Strip `avfs://file/` prefix
3. Restore platform-native path separator
4. Apply platform-specific root resolution

**Platform-Specific Behavior**:

| Platform | Root Resolution |
|----------|----------------|
| Linux/macOS | `/` + remaining path |
| Windows | Drive letter detection or CWD-relative |

**Examples**:

| AVFS Address | Native Path (Linux) | Native Path (Windows) |
|-------------|--------------------|----------------------|
| `avfs://file/home/user/doc.txt` | `/home/user/doc.txt` | `C:\home\user\doc.txt` |
| `avfs://file/d/work/bin.exe` | `/d/work/bin.exe` | `D:\work\bin.exe` |

---

## 3. HTTP/HTTPS URL ↔ AVFS

### 3.1 HTTP URL → AVFS (`toAvfs`)

**Algorithm**:
1. Parse URL into components (scheme, host, port, path, query, fragment)
2. Determine AVFS protocol: `http:` → `http`, `https:` → `https`
3. Build `resource-base`: `{host}[:{port}]`
4. Set `file-path`: URL pathname (without leading `/`)
5. Map fragment to `#anchor`
6. Encode query parameters if significant

**Examples**:

| HTTP(S) URL | AVFS Address |
|------------|-------------|
| `http://192.168.1.100:8080/api/data.csv` | `avfs://http/192.168.1.100:8080/api/data.csv` |
| `https://cdn.example.com/files/v1/package.zip` | `avfs://https/cdn.example.com/files/v1/package.zip` |
| `http://inner.server:9000/docs?ver=2#section1` | `avfs://http/inner.server:9000/docs?ver=2#section1` |

**Edge Cases**:

| Input | Handling |
|-------|----------|
| URL with authentication (`user:pass@host`) | Strip credentials (security); warn in verbose mode |
| URL with query string | Preserve as-is in file-path or separate field |
| URL fragment (`#`) | Map directly to AVFS `#anchor` |
| Default port (80/443) | Omit from `resource-base` |
| IPv6 address `[::1]` | Preserve brackets in `resource-base` |

### 3.2 AVFS → HTTP URL (`toNative`)

**Algorithm**:
1. Extract protocol → URL scheme (`http` → `http:`, `https` → `https:`)
2. Combine: `{scheme}//{resource-base}/{file-path}[#{anchor}]`
3. Reconstruct query string if present

**Examples**:

| AVFS Address | HTTP(S) URL |
|-------------|------------|
| `avfs://http/192.168.3.20:8090/rule.yaml` | `http://192.168.3.20:8090/rule.yaml` |
| `avfs://https/avfs.io/spec/standard.pdf` | `https://avfs.io/spec/standard.pdf` |

---

## 4. SMB Path ↔ AVFS

### 4.1 SMB UNC Path → AVFS (`toAvfs`)

**SMB UNC Format**: `\\{host}\{share}\{path}`

**Algorithm**:
1. Parse host, share, and sub-path from UNC
2. Build `resource-base`: `{host}/{share}`
3. Set `file-path`: sub-path within share

**Examples**:

| SMB UNC Path | AVFS Address |
|-------------|-------------|
| `\\192.168.1.60\share\docs\report.xlsx` | `avfs://smb/192.168.1.60/share/docs/report.xlsx` |
| `\\office.host\public\media\demo.mp4` | `avfs://smb/office.host/public/media/demo.mp4` |
| `\\server\data\..\archive\backup.tar.gz` | `avfs://smb/server/data/archive/backup.tar.gz` |

**Edge Cases**:

| Input | Handling |
|-------|----------|
| IP address | Use as-is |
| DNS hostname | Use as-is (NetBIOS or FQDN) |
| Port specification (`host:445`) | Include in `resource-base` if non-default |
| Auth domain (`DOMAIN\user`) | Store in credentials, strip from address |

### 4.2 AVFS → SMB Path (`toNative`)

Reverse of above algorithm.

---

## 5. Git Repository URL ↔ AVFS

### 5.1 Git URL → AVFS (`toAvfs`)

This is the most complex conversion due to vendor-specific URL structures.

**Supported Git Platforms**:

| Vendor | Native Clone URL Pattern | Example |
|--------|------------------------|---------|
| GitHub | `https://github.com/{owner}/{repo}.git` | `github.com/avfs-io/core` |
| GitLab | `https://gitlab.com/{group}/{project}.git` | `gitlab.com/team/project` |
| Azure DevOps | `dev.azure.com/{org}/{_git}/{repo}` | `dev.azure.com/team/_git/service` |
| Bitbucket | `https://bitbucket.org/{team}/{repo}.git` | `bitbucket.org/team/runtime` |
| Self-hosted Git | `https://{domain}/{path}/{repo}.git` | `git.company.internal/ai/group/engine` |
| SSH-style | `git@github.com:{owner}/{repo}.git` | Converted to HTTPS form |

**Algorithm**:
1. Detect vendor type from URL structure
2. Extract vendor-specific components (org, repo, project, etc.)
3. Build `resource-base` preserving vendor-native hierarchy
4. Extract branch/tag/commit if specified (→ `@version`)
5. Set `file-path` to repository-internal path

**GitHub Examples**:

| Git Context | AVFS Address |
|-------------|-------------|
| `github.com/avfs-io/core` (default branch) | `avfs://git/github.com/avfs-io/core/readme.md` |
| `github.com/avfs-io/core`, branch `dev` | `avfs://git/github.com/avfs-io/core@dev/driver/smb.client` |
| `github.com/avfs-io/core`, tag `v1.0.0` | `avfs://git/github.com/avfs-io/core@v1.0.0/script/build.sh` |
| `github.com/avfs-io/core`, commit `9a27c1f` | `avfs://git/github.com/avfs-io/core@9a27c1f/module/kernel.so` |

**Azure DevOps Examples**:

| Git Context | AVFS Address |
|-------------|-------------|
| Azure DevOps, org=`team`, project=`org`, repo=`service`, branch=`main` | `avfs://git/dev.azure.com/team/org/_git/service@main/src/entry.jar` |
| Azure DevOps, repo=`platform`, branch=`hotfix` | `avfs://git/dev.azure.com/team/org/_git/platform@hotfix/util/check.dll` |

**Self-hosted / Bitbucket Examples**:

| Git Context | AVFS Address |
|-------------|-------------|
| Self-hosted Git, branch=`release` | `avfs://git/git.company.internal/ai/group/engine@release/doc/design.vsdx` |
| Bitbucket, branch=`main` | `avfs://git/bitbucket.org/team/avfs-runtime@main/conf/env.ini` |

**Version Lock Semantics**:

| Version Type | Lock Behavior |
|-------------|---------------|
| Branch (e.g., `@main`, `@dev`) | Floating — always points to latest commit on that branch |
| Tag (e.g., `@v1.0.0`) | Immutable — always resolves to the same commit |
| Commit hash (e.g., `@9a27c1f`) | Immutable — pinpoints exact revision |

### 5.2 AVFS → Git URL (`toNative`)

**Algorithm**:
1. Extract `protocol === 'git'`
2. Parse vendor from `resource-base` structure
3. Reconstruct vendor-specific clone URL
4. Extract version info for refspec
5. Derive file path within working tree

**Round-Trip Guarantee**:

```
native_git_url → avfs_address → reconstructed_git_url
```

The reconstructed URL may differ syntactically but must resolve to the exact same repository and revision.

---

## 6. Custom Protocol Conversion

For user-defined protocols, conversion follows a pluggable strategy:

### 6.1 Implementing Custom Converter

```typescript
import { registerConverter } from '@avfs/core';

const ossConverter: AddressConverter = {
  protocol: 'oss',

  toAvfs(nativePath: string): ParsedAddress {
    // Parse OSS URI like: oss://bucket-name/path/to/object
    const [, bucket, ...pathParts] = nativePath.match(/oss:\/\/([^\/]+)\/(.*)/) || [];
    return parseAddress(
      `avfs://oss/${bucket}/${pathParts.join('/')}`
    );
  },

  toNative(avfsAddr: ParsedAddress): string {
    // Reconstruct OSS URI
    return `oss://${avfsAddr.resourceBase}/${avfsAddr.filePath}`;
  }
};

registerConverter(ossConverter);
```

### 6.2 Fallback Behavior

If no custom converter is registered for a protocol:

- `toAvfs`: Wrap native path as `avfs://{protocol}/{native-path}`
- `toNative`: Extract and return `{resource-base}/{filePath}` as-is

---

## 7. Conversion API Reference

### 7.1 Programmatic Usage

```typescript
import { convertToAvfs, convertToNative } from '@avfs/core';

// Native → AVFS
const addr = convertToAVfs('/home/user/file.txt');
// → ParsedAddress { protocol: 'file', resourceBase: '', filePath: 'home/user/file.txt' }

// AVFS → Native
const path = convertToNative('avfs://git/github.com/owner/repo@main/src/index.ts');
// → Platform-specific git reference string

// With options
const opts = { normalize: true, validate: true };
const addr2 = convertToAVfs(nativePath, opts);
```

### 7.2 CLI Usage

```bash
# Native → AVFS
avfs convert /home/user/config.json --to-avfs
# Output: avfs://file/home/user/config.json

# AVFS → Native
avfs convert "avfs://git/github.com/avfs-io/core@v1.0.0/readme.md" --to-native
# Output: github.com/avfs-io/core (at tag v1.0.0), path: readme.md
```

### 7.3 Batch Conversion

```bash
# Convert multiple paths from file
avfs convert --batch input-paths.txt --to-avfs --output converted-addrs.txt

# stdin pipe support
cat urls.txt | avfs convert --from-format url --to-avfs
echo "avfs://file/data.bin" | avfs convert --to-native
```
