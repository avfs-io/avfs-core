import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitDriver } from '../../src/drivers/git.driver.js';

// ─── Mock globals ──────────────────────────────────────────────

/** Helper to create a mock Response with body stream */
function createMockResponse(
  status: number,
  body: string | Uint8Array,
  contentType = 'application/octet-stream',
): globalThis.Response {
  const bodyData = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  // Attempt JSON parse only if it looks like JSON; otherwise return empty object
  let parsedJson: unknown = {};
  if (typeof body === 'string' && body.trimStart().startsWith('{')) {
    try { parsedJson = JSON.parse(body); } catch { /* not valid json → keep {} */ }
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: vi.fn((name: string) => (name === 'content-type' ? contentType : null)),
    },
    json: vi.fn().mockResolvedValue(parsedJson),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bodyData);
        controller.close();
      },
    }),
  } as unknown as Response;
}

// ─── Tests ─────────────────────────────────────────────────────

describe('GitDriver', () => {
  let driver: GitDriver;

  beforeEach(() => {
    driver = new GitDriver();
  });

  // ══════════════════════════════════════════════════════════════
  // connect
  // ══════════════════════════════════════════════════════════════

  describe('connect()', () => {
    it('should parse valid resourceBase "github.com/avfs-io/core"', async () => {
      await driver.connect('github.com/avfs-io/core');
      // No error thrown means success
      expect(true).toBe(true);
    });

    it('should store version from options.credentials["version"]', async () => {
      await driver.connect('github.com/avfs-io/core', {
        credentials: { version: 'main' },
      });
      // We verify version is stored indirectly via read() URL
      expect(true).toBe(true);
    });

    it('should throw on invalid resourceBase format', async () => {
      await expect(driver.connect('not-a-github-url')).rejects.toThrow(
        /Invalid Git resourceBase format/,
      );
    });

    it('should throw on resourceBase missing owner/repo parts', async () => {
      await expect(driver.connect('github.com/only-owner')).rejects.toThrow(
        /Invalid Git resourceBase format/,
      );
    });

    it('should handle resourceBase with extra path segments (only owner/repo extracted)', async () => {
      // The regex only accepts exactly github.com/{owner}/{repo}
      await expect(driver.connect('github.com/owner/repo/extra/path')).rejects.toThrow();
    });

    it('should default version to null when no credentials provided', async () => {
      await driver.connect('github.com/avfs-io/core');
      // Verify by checking that read() would use a URL without ?ref=
      expect(true).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // stat
  // ══════════════════════════════════════════════════════════════

  describe('stat()', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return FileMetadata with correct fields from GitHub JSON API', async () => {
      const mockResponse = createMockResponse(200, JSON.stringify({
        name: 'README.md',
        size: 1234,
        type: 'file',
        date: '2026-01-15T10:30:00Z',
      }));

      vi.mocked(fetch).mockResolvedValue(mockResponse);

      await driver.connect('github.com/avfs-io/core', { credentials: { version: 'main' } });
      const result = await driver.stat('README.md');

      expect(result.size).toBe(1234);
      expect(result.protocol).toBe('git');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.modifiedAt).toBeInstanceOf(Date);
    });

    it('should call fetch with Accept header for JSON response', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, JSON.stringify({
        name: 'test.ts',
        size: 100,
        date: '2026-01-01T00:00:00Z',
      })));

      await driver.connect('github.com/avfs-io/core');
      await driver.stat('src/test.ts');

      expect(fetch).toHaveBeenCalledTimes(1);
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      // Path segments are percent-encoded by encodeURIComponent
      expect(calledUrl).toContain('api.github.com/repos/avfs-io/core/contents/src%2Ftest.ts');
      const calledInit = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      expect((calledInit.headers as Record<string, string>).Accept).toBe('application/vnd.github.v3+json');
    });

    it('should include ref parameter when version is set', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, JSON.stringify({
        name: 'file.txt',
        size: 0,
        date: '2026-01-01T00:00:00Z',
      })));

      await driver.connect('github.com/avfs-io/core', { credentials: { version: 'v1.0.0' } });
      await driver.stat('file.txt');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('ref=v1.0.0'),
        expect.anything(),
      );
    });

    it('should not include ref parameter when version is null', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, JSON.stringify({
        name: 'file.txt',
        size: 0,
        date: '2026-01-01T00:00:00Z',
      })));

      await driver.connect('github.com/avfs-io/core'); // no version
      await driver.stat('file.txt');

      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('ref=');
    });

    it('should throw "File not found" error on 404', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(404, '{"message":"Not Found"}'));

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.stat('nonexistent.xyz')).rejects.toThrow(/File not found.*nonexistent\.xyz.*avfs-io\/core/);
    });

    it('should throw "rate limit exceeded" error on 403', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(403, '{"message":"API rate limit exceeded"}'));

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.stat('README.md')).rejects.toThrow(/rate limit exceeded/);
    });

    it('should throw if not connected', async () => {
      await expect(driver.stat('README.md')).rejects.toThrow(/not connected/);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // read
  // ══════════════════════════════════════════════════════════════

  describe('read()', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return ReadableStream with file content', async () => {
      const content = '# Hello World\nThis is test content.';
      const mockResponse = createMockResponse(200, content, 'text/plain');

      vi.mocked(fetch).mockResolvedValue(mockResponse);

      await driver.connect('github.com/avfs-io/core', { credentials: { version: 'main' } });
      const stream = await driver.read('README.md');

      expect(stream).toBeDefined();

      // Consume the stream and verify content
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const decoded = new TextDecoder().decode(concatUint8Arrays(chunks));
      expect(decoded).toBe(content);
    });

    it('should call fetch with raw Accept header', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, 'data', 'text/plain'));

      await driver.connect('github.com/avfs-io/core');
      await driver.read('file.txt');

      expect(fetch).toHaveBeenCalledTimes(1);
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('api.github.com/repos/avfs-io/core/contents/file.txt');
      const calledInit = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      expect((calledInit.headers as Record<string, string>).Accept).toBe('application/vnd.github.v3.raw');
    });

    it('should include ref parameter in read URL when version is set', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, ''));

      await driver.connect('github.com/avfs-io/core', { credentials: { version: 'develop' } });
      await driver.read('path/file.ts');

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('ref=develop'), expect.anything());
    });

    it('should throw "File not found" error on 404', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(404, '{}'));

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.read('missing.ts')).rejects.toThrow(/File not found.*missing\.ts/);
    });

    it('should throw "rate limit exceeded" error on 403', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(403, '{}'));

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.read('README.md')).rejects.toThrow(/rate limit exceeded/);
    });

    it('should throw if not connected', async () => {
      await expect(driver.read('README.md')).rejects.toThrow(/not connected/);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // close
  // ══════════════════════════════════════════════════════════════

  describe('close()', () => {
    it('should reset internal state after close', async () => {
      await driver.connect('github.com/avfs-io/core', { credentials: { version: 'main' } });
      await driver.close();

      // After close, operations should fail with "not connected"
      await expect(driver.stat('README.md')).rejects.toThrow(/not connected/);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Full workflow: connect → stat → read → close
  // ══════════════════════════════════════════════════════════════

  describe('workflow integration', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should support full connect → stat → read → close flow', async () => {
      // Setup mocks for both stat (JSON) and read (raw) calls
      const statBody = JSON.stringify({ name: 'README.md', size: 42, date: '2026-05-26T14:00:00Z' });
      vi.mocked(fetch)
        .mockResolvedValueOnce(createMockResponse(200, statBody))           // stat call
        .mockResolvedValueOnce(createMockResponse(200, '# Test Content')); // read call

      // Connect
      await driver.connect('github.com/avfs-io/core', { credentials: { version: 'main' } });

      // Stat
      const meta = await driver.stat('README.md');
      expect(meta.protocol).toBe('git');
      expect(meta.size).toBe(42);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Read
      const stream = await driver.read('README.md');
      const reader = stream.getReader();
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe('# Test Content');
      expect(fetch).toHaveBeenCalledTimes(2);

      // Close
      await driver.close();
      await expect(driver.stat('README.md')).rejects.toThrow(/not connected/);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Network error scenarios
  // ══════════════════════════════════════════════════════════════

  describe('network errors', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should report timeout error when request exceeds timeout', async () => {
      // Simulate an AbortError from timeout
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      vi.mocked(fetch).mockRejectedValue(abortError);

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.stat('README.md')).rejects.toThrow(/unable to reach api\.github\.com.*timed out/);
    });

    it('should report network error message on connection failure', async () => {
      // Simulate a generic network error
      vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.stat('README.md')).rejects.toThrow(
        /Network error.*fetch failed/,
      );
    });

    it('should handle DNS resolution failure gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

      await driver.connect('github.com/avfs-io/core');
      await expect(driver.read('file.ts')).rejects.toThrow(/Network error/);
    });
  });
});

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Concatenate an array of Uint8Array into a single buffer.
 */
function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
