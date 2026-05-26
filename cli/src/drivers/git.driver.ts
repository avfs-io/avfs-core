import type { Driver, ConnectOptions, FileMetadata } from './driver.interface.js';

/** Default API request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/** GitHub REST API base URL */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Parse a GitHub resourceBase string into owner and repo.
 *
 * @param resourceBase - Expected format: "github.com/{owner}/{repo}"
 * @returns Object with `owner` and `repo` fields
 * @throws If the format does not match expected pattern
 */
function parseResourceBase(resourceBase: string): { owner: string; repo: string } {
  // Expect format: github.com/{owner}/{repo}
  const match = resourceBase.match(/^github\.com\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(
      `Invalid Git resourceBase format: "${resourceBase}". Expected "github.com/{owner}/{repo}".`,
    );
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Build GitHub Contents API URL.
 */
function buildContentsUrl(owner: string, repo: string, path: string, ref?: string | null): string {
  let url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  if (ref) {
    url += `?ref=${encodeURIComponent(ref)}`;
  }
  return url;
}

/**
 * Classify HTTP error status codes into user-friendly messages.
 */
function classifyHttpError(status: number, filePath: string, owner: string, repo: string): string {
  switch (status) {
    case 404:
      return `File not found: ${filePath} in ${owner}/${repo}`;
    case 403:
      return 'GitHub API rate limit exceeded. Try again later.';
    default:
      return `GitHub API request failed with status ${status}: ${filePath}`;
  }
}

/**
 * Git protocol driver backed by the GitHub REST API (Contents endpoint).
 *
 * Supports anonymous read access to **public repositories** only.
 * Uses Node.js built-in `fetch()` — zero runtime dependencies added.
 *
 * Version is passed via the AVFS URI `?ref=` query parameter,
 * which eliminates ambiguity when branch names contain "/".
 *
 * @remarks Replaces FT-001 stub with a real implementation for Phase 3.
 */
export class GitDriver implements Driver {
  readonly protocol = 'git';

  /** Parsed repository owner (e.g. "avfs-io") */
  private owner = '';

  /** Parsed repository name (e.g. "core") */
  private repo = '';

  /** Git ref (branch / tag / commit SHA) from ?ref= query parameter */
  private version: string | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────

  async connect(resourceBase: string, options?: ConnectOptions): Promise<void> {
    const parsed = parseResourceBase(resourceBase);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
    this.version = options?.credentials?.['version'] ?? null;
  }

  async close(): Promise<void> {
    this.owner = '';
    this.repo = '';
    this.version = null;
  }

  // ─── File operations ─────────────────────────────────────────

  /**
   * Retrieve file metadata via the GitHub Contents API (JSON response).
   *
   * API: GET /repos/{owner}/{repo}/contents/{path}?ref={version}
   * Header: Accept: application/vnd.github.v3+json
   */
  async stat(filePath: string): Promise<FileMetadata> {
    this.ensureConnected();

    const url = buildContentsUrl(this.owner, this.repo, filePath, this.version);
    const response = await this.fetchWithTimeout(url, { headers: { Accept: 'application/vnd.github.v3+json' } });

    if (!response.ok) {
      throw new Error(classifyHttpError(response.status, filePath, this.owner, this.repo));
    }

    const json = await response.json();
    return {
      size: json.size ?? 0,
      mimeType: this.inferMimeType(json.name ?? filePath),
      modifiedAt: json.date ? new Date(json.date) : new Date(),
      protocol: 'git',
    };
  }

  /**
   * Read file raw content via the GitHub Contents API (raw response).
   *
   * API: GET /repos/{owner}/{repo}/contents/{path}?ref={version}
   * Header: Accept: application/vnd.github.v3.raw
   *
   * Returns a ReadableStream of Uint8Array chunks.
   */
  async read(filePath: string): Promise<ReadableStream<Uint8Array>> {
    this.ensureConnected();

    const url = buildContentsUrl(this.owner, this.repo, filePath, this.version);
    const response = await this.fetchWithTimeout(url, { headers: { Accept: 'application/vnd.github.v3.raw' } });

    if (!response.ok) {
      throw new Error(classifyHttpError(response.status, filePath, this.owner, this.repo));
    }

    return response.body!;
  }

  // ─── Internal helpers ────────────────────────────────────────

  /**
   * Guard: ensure connect() was called before read/stat operations.
   */
  private ensureConnected(): void {
    if (!this.owner || !this.repo) {
      throw new Error('GitDriver not connected. Call connect() first.');
    }
  }

  /**
   * Wrapper around fetch with an AbortController timeout (default 30 s).
   * Transforms network-level errors into descriptive messages.
   */
  private async fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Network error: unable to reach api.github.com (timed out).');
      }
      // Generic network failure (DNS, connection refused, etc.)
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Network error: unable to reach api.github.com (${message}).`);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Simple MIME type inference based on file extension.
   * Used when the API does not return a reliable mime_type field.
   */
  private inferMimeType(filename: string): string {
    const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
    const map: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.ts': 'application/typescript',
      '.tsx': 'text/typescript-jsx',
      '.js': 'application/javascript',
      '.jsx': 'text/javascript',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.sh': 'application/x-sh',
      '.py': 'text/x-python',
      '.rs': 'text/rust',
      '.go': 'text/x-go',
      '.java': 'text/x-java',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
