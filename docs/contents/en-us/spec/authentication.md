# AVFS Authentication Specification

> Part of [AVFS v1 Standard](./avfs-v1-standard.md) — Credential management and authentication model for the protocol-driver plugin architecture.

## 1. Design Principles

AVFS adopts a **separation of credential routing and authentication execution**, leveraging the protocol-driver architecture:

| Layer | Responsibility | Does NOT |
|-------|---------------|----------|
| **Core (Credential Store)** | Store, resolve, and route credentials to the correct driver | Perform authentication; understand driver-specific auth protocols |
| **Driver** | Consume credentials and execute auth against the target backend | Know where credentials come from; manage credential lifecycle |

This ensures:
- Drivers handle **how** to authenticate (token, password, certificate, OAuth, etc.)
- Core handles **which** credential applies to **which** resource
- Agents provide or configure credentials without coupling to any specific transport

## 2. Core Architecture

```
Agent / User / Secret Manager
        │
        ▼
┌───────────────────────────────────────────┐
│           Credential Store (Core)          │
│                                            │
│  Resolves (protocol, resourceBase) → creds │
│  Sources: env, file, vault, agent override │
└──────────────────┬────────────────────────┘
                   │ DriverConfig { credentials }
                   ▼
┌───────────────────────────────────────────┐
│              Driver (e.g. git)             │
│  Uses creds.token → GitHub API auth        │
│  Uses creds.user/pass → SMB login          │
│  Independent auth logic per driver         │
└───────────────────────────────────────────┘
```

## 3. Credential Store Interface

The `CredentialStore` is a core service that resolves credentials for any incoming request.

```typescript
interface CredentialStore {
  /**
   * Resolve credentials for a given protocol and resource base.
   * Returns null if no credentials are configured (anonymous access).
   */
  resolve(protocol: string, resourceBase: string): Promise<Record<string, string> | null>;

  /**
   * Register credentials for an exact (protocol, resourceBase) pair.
   */
  set(protocol: string, resourceBase: string, credentials: Record<string, string>): Promise<void>;

  /**
   * Register credentials using a pattern.
   * Supports wildcard matching: "git/github.com/*" matches all GitHub repos.
   */
  setPattern(pattern: string, credentials: Record<string, string>): Promise<void>;

  /**
   * Remove credentials for a given scope.
   */
  remove(protocol: string, resourceBase: string): Promise<void>;

  /**
   * Load credentials from an external backend.
   */
  loadBackend(type: 'env' | 'file' | 'vault' | 'agent', config: Record<string, unknown>): Promise<void>;

  /**
   * List all registered credential scopes (without secret values).
   */
  listScopes(): Promise<CredentialScope[]>;
}

interface CredentialScope {
  protocol: string;
  resourceBase: string;
  isPattern: boolean;
  source: 'env' | 'file' | 'vault' | 'agent' | 'manual';
}
```

## 4. Credential Resolution

### 4.1 Matching Algorithm

When a request arrives at `avfs://<protocol>/<resourceBase>/<path>`, the core resolves credentials as follows:

1. **Exact match** — Look up `(protocol, resourceBase)` in the store
2. **Pattern match** — If no exact match, iterate registered patterns (most specific wins)
3. **Default** — If still no match, return `null` (anonymous access)

```typescript
function resolveCredentials(store: CredentialStore, protocol: string, resourceBase: string) {
  // 1. Exact match
  let creds = await store.resolve(protocol, resourceBase);
  if (creds) return creds;

  // 2. Pattern match (longest prefix match)
  const patterns = store.listPatterns(protocol);
  patterns.sort((a, b) => b.pattern.length - a.pattern.length); // most specific first
  for (const p of patterns) {
    if (matchPattern(resourceBase, p.pattern)) {
      return store.resolve(protocol, p.pattern);
    }
  }

  // 3. Anonymous
  return null;
}
```

### 4.2 Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `*` | All resources under the given protocol |
| `github.com/*` | All resources on github.com |
| `github.com/avfs-io/*` | All repos under the avfs-io org |
| `*.internal` | All resources on *.internal hosts |

### 4.3 Examples

**Setup:**

```typescript
store.set('git', 'github.com/*', { token: 'ghp_xxx' });
store.set('smb', 'fileserver.internal', { username: 'admin', password: 's3cret' });
store.set('https', 'api.private.io', { cert: '/path/to/cert.pem', key: '/path/to/key.pem' });
```

**Resolution:**

| Request Address | Resolved Credentials |
|-----------------|---------------------|
| `avfs://git/github.com/avfs-io/core/readme.md` | `{ token: 'ghp_xxx' }` |
| `avfs://git/gitlab.com/other/repo/file.go` | `null` (no match) |
| `avfs://smb/fileserver.internal/share/doc.pdf` | `{ username: 'admin', password: 's3cret' }` |
| `avfs://smb/other.server/share/x.txt` | `null` (no match) |
| `avfs://https/api.private.io/data` | `{ cert: '...', key: '...' }` |

## 5. Credential Sources & Priority

Credentials can originate from multiple sources. When multiple sources provide credentials for the same scope, the following priority applies (highest first):

| Priority | Source | Use Case |
|----------|--------|----------|
| 1 (highest) | **Agent override** | Agent explicitly passes credentials for a specific request |
| 2 | **Vault / Secret Manager** | Enterprise deployments (HashiCorp Vault, AWS Secrets Manager, etc.) |
| 3 | **Configuration file** | `~/.avfs/credentials.json` — user-local or project-local |
| 4 | **Environment variables** | CI/CD pipelines, containerized environments |
| 5 (lowest) | **Anonymous / Public** | Public resources requiring no authentication |

### 5.1 Environment Variables

```bash
# Per-protocol, per-resource
export AVFS_CRED_GIT_GITHUB_COM_TOKEN="ghp_xxx"
export AVFS_CRED_SMB_FILESERVER_USER="admin"
export AVFS_CRED_SMB_FILESERVER_PASS="s3cret"

# Wildcard
export AVFS_CRED_GIT_ALL_TOKEN="glpat-xxx"  # AVFS_CRED_<PROTO>_ALL_<KEY>
```

### 5.2 Configuration File (`~/.avfs/credentials.json`)

```json
{
  "credentials": [
    {
      "protocol": "git",
      "resourceBase": "github.com/*",
      "values": { "token": "ghp_xxx" }
    },
    {
      "protocol": "smb",
      "resourceBase": "fileserver.internal",
      "values": { "username": "admin", "password": "s3cret" }
    },
    {
      "protocol": "https",
      "resourceBase": "*.private.io",
      "values": { "certFile": "/etc/avfs/certs/client.pem", "keyFile": "/etc/avfs/certs/client.key" }
    }
  ]
}
```

### 5.3 Agent Override

Agents may supply credentials at request time, which take the highest priority:

```typescript
const result = await avfs.read('avfs://git/github.com/team/repo@main/config.yaml', {
  credentials: { token: 'ghp_one-time-token' }  // ← overrides all other sources
});
```

## 6. Driver's Role in Authentication

### 6.1 Contract

Each driver **MUST**:
- Read credentials from `this.config.credentials` (populated by core before `connect()`)
- Perform its own authentication logic (the core never knows how a driver authenticates)
- Throw `AuthenticationError` when authentication fails
- Handle credential absence gracefully (attempt anonymous access or throw `AuthenticationError`)

Each driver **MUST NOT**:
- Hard-code credential sources (env vars, files, etc.)
- Leak credentials to logs, error messages, or other drivers
- Share credentials across different resource bases unless explicitly configured to do so

### 6.2 Example: Git Driver

```typescript
class GitDriver implements AVFSDriver {
  readonly protocol = 'git';

  async connect(address: ParsedAddress): Promise<Connection> {
    const token = this.config.credentials?.token;
    const client = token
      ? new GitClient({ auth: `Bearer ${token}` })
      : new GitClient(); // anonymous

    await client.ping(address.resourceBase); // throws AuthenticationError on 401
    return new GitConnection(client, address);
  }
}
```

### 6.3 Example: SMB Driver

```typescript
class SMBDriver implements AVFSDriver {
  readonly protocol = 'smb';

  async connect(address: ParsedAddress): Promise<Connection> {
    const { username, password } = this.config.credentials ?? {};
    if (!username) throw new AuthenticationError('SMB requires username');

    const session = await smbClient.connect(address.resourceBase, { username, password });
    return new SMBConnection(session);
  }
}
```

### 6.4 Example: Custom Driver with mTLS

```typescript
class MutualTLSDriver implements AVFSDriver {
  readonly protocol = 'mtls';

  async connect(address: ParsedAddress): Promise<Connection> {
    const { cert, key, ca } = this.config.credentials ?? {};
    const httpsAgent = new Agent({ cert, key, ca, rejectUnauthorized: true });
    const response = await fetch(`https://${address.resourceBase}/${address.filePath}`, { agent: httpsAgent });
    if (response.status === 401) throw new AuthenticationError('mTLS handshake failed');
    // ...
  }
}
```

## 7. Security Requirements

### 7.1 Credential Isolation

Credentials registered for one driver **MUST NOT** be accessible to any other driver. The core enforces this at the credential store level:

```typescript
// The core only passes credentials to the matched driver
const creds = store.resolve(protocol, resourceBase);
const config: DriverConfig = { credentials: creds ?? undefined };
await driver.initialize(config); // ← only this driver sees these creds
```

### 7.2 Sanitization

- Credential values **MUST NOT** appear in logs, error messages, or event payloads
- Error messages must use generic descriptions: `"Authentication failed for github.com"` — never `"Token ghp_xxx is invalid"`
- Debug/trace modes must redact credential fields

### 7.3 Storage Encryption

- File-based credential storage (`~/.avfs/credentials.json`) **SHOULD** support encryption at rest
- In-memory credentials **SHOULD** be held in isolated memory regions where platform capabilities allow
- Credentials loaded from environment variables **SHOULD** be cleared from process environment after loading

### 7.4 Transport Security

- Drivers communicating over the network **SHOULD** use encrypted channels (TLS 1.2+) for credential-bearing requests
- Credentials **MUST NOT** be transmitted as URL query parameters
- The `https` driver **MUST** validate TLS certificates by default (configurable opt-out for development)

## 8. Error Handling

All authentication-related errors use the standard `AuthenticationError` type defined in the [Driver Interface](./driver-interface.md#4-error-types).

```typescript
class AuthenticationError extends AVFSError {
  code = 'AUTH_FAILED';
}

// Driver usage:
throw new AuthenticationError(`Authentication failed for ${address.resourceBase}`);
```

The core catches `AuthenticationError` from drivers and may:
1. Return the error to the caller (agent)
2. Trigger a credential refresh if a refresh callback is configured
3. Attempt the next matching credential set if multiple are available

## 9. Credential Lifecycle

### 9.1 Registration

Credentials are loaded when:
- The runtime starts (from config files and environment variables)
- An agent calls `store.set()` or `store.setPattern()`
- A backend is loaded via `store.loadBackend()`

### 9.2 Refresh

Drivers may indicate that credentials need rotation:

```typescript
interface DriverConfig {
  credentials?: Record<string, string>;
  onCredentialsExpired?: (protocol: string, resourceBase: string) => Promise<Record<string, string>>;
}
```

When a driver throws `AuthenticationError` with a hint of expiry, the core calls `onCredentialsExpired` to obtain fresh credentials and retries the operation once.

### 9.3 Revocation

Credentials can be removed via:
- `store.remove(protocol, resourceBase)` — programmatic removal
- `avfs credential revoke <protocol> <resourceBase>` — CLI command
- Automatic expiry based on TTL (if configured per credential entry)

## 10. CLI Commands

```bash
# Set credentials
avfs credential set git github.com --token "ghp_xxx"
avfs credential set smb fileserver.internal --username admin --password "s3cret"

# List configured credential scopes (secrets hidden)
avfs credential list

# Remove credentials
avfs credential revoke git github.com

# Load from file
avfs credential load --file ~/.avfs/credentials.json
```
