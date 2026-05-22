# Driver

Built-in five category official access driver implementations.

## Built-in Drivers

| Driver | Protocol | Resource Type | Status |
|--------|----------|--------------|--------|
| `file-driver` | `file` | Local filesystem IO access (all file formats, binary transparent) | Planned |
| `http-driver` | `http` | Plain HTTP network request (intranet resources) | Planned |
| `https-driver` | `https` | Encrypted HTTPS secure fetch (public cloud CDN, web resources) | Planned |
| `smb-driver` | `smb` | LAN SMB/CIFS shared storage access client | Planned |
| `git-driver` | `git` | Versioned Git repository retrieval (multi-vendor support) | Planned |

## Each Driver Must Implement

```typescript
interface AvfsDriver {
  // Connect to resource source
  connect(resourceBase: string): Promise<void>;

  // Read raw binary stream + metadata for a given file path at optional version
  read(filePath: string, version?: string): Promise<AvfsResource>;

  // Stat file metadata without reading content
  stat(filePath: string, version?: string): Promise<AvfsMetadata>;

  // Extract content anchor (line number or section marker)
  anchor(filePath: string, anchor: string, version?: string): Promise<string>;

  // Cleanup connection
  close(): Promise<void>;
}
```

## Git Driver Multi-Vendor Support

| Platform | Path Pattern Example |
|----------|---------------------|
| GitHub | `github.com/{owner}/{repo}@{branch}/{path}` |
| GitLab | `gitlab.com/{owner}/{repo}/-//{branch}/{path}` |
| Gitee | `gitee.com/{owner}/{repo}/blob/{branch}/{path}` |
| Azure DevOps | `dev.azure.com/{org}/{project}/_git/{repo}@{branch}/{path}` |
| Bitbucket | `bitbucket.org/{owner}/{repo}/src/{branch}/{path}` |
| Self-hosted | `{git-host}/{path}@{version}/{file}` |

## Directory Layout (Planned)

```
driver/
├── file/
│   ├── file.driver.ts
│   └── README.md
├── http/
│   ├── http.driver.ts
│   └── README.md
├── https/
│   ├── https.driver.ts
│   └── README.md
├── smb/
│   ├── smb.driver.ts
│   └── README.md
└── git/
    ├── git.driver.ts
    ├── vendors/
    │   ├── github.ts
    │   ├── gitlab.ts
    │   ├── gitee.ts
    │   ├── azure-devops.ts
    │   └── bitbucket.ts
    └── README.md
```

## Dependencies

- [Core](../core/README.md) — Registry interface each driver registers to
- [Spec](../spec/README.md) — Driver interface contract specification
- [Plugin SDK](../plugin-sdk/README.md) — Base classes for driver implementation
