import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerFetchCommand } from '../../src/commands/fetch.command.js';

// ─── Test fixtures ───────────────────────────────────────────────

const TEST_OUTPUT_DIR = join(process.cwd(), '.test-fetch-output');
const SAMPLE_CONTENT = '# AVFS Core\n\nA cross-storage addressing protocol.\n';

/** Helper to create a mock Response with body stream (mirrors git.driver.test.ts pattern) */
function createMockResponse(
  status: number,
  body: string | Uint8Array,
  contentType = 'application/octet-stream',
): globalThis.Response {
  const bodyData = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: vi.fn((name: string) => (name === 'content-type' ? contentType : null)),
    },
    json: vi.fn().mockResolvedValue({}),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bodyData);
        controller.close();
      },
    }),
  } as unknown as Response;
}

/** Create a fresh Commander program with fetch command registered */
function createProgram(): Command {
  const program = new Command();
  program
    .name('avfs')
    .exitOverride((err) => {
      // Throw instead of calling process.exit() so tests can catch it
      throw err;
    });
  registerFetchCommand(program);
  return program;
}

/**
 * Parse arguments safely.
 * Note: Commander v14 defaults to `from: 'node'` which skips argv[0] and argv[1].
 * We must pass `{ from: 'user' }` so that our test args array is used verbatim.
 */
async function parseSafely(program: Command, args: string[]): Promise<{ thrown: boolean; error?: Error }> {
  try {
    await program.parseAsync(args, { from: 'user' });
    return { thrown: false };
  } catch (error: unknown) {
    return { thrown: true, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

// ─── Tests ───────────────────────────────────────────────────────

describe('fetch command', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    if (!existsSync(TEST_OUTPUT_DIR)) {
      mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
    process.exitCode = 0;
  });

  // ══════════════════════════════════════════════════════════════
  // Normal flow: git URI → stdout / -o file
  // ══════════════════════════════════════════════════════════════

  describe('git URI fetch to stdout', () => {
    it('should output file content to stdout for a valid git AVFS URI', async () => {
      const mockResponse = createMockResponse(200, SAMPLE_CONTENT, 'text/markdown');
      vi.mocked(fetch).mockResolvedValue(mockResponse);

      const program = createProgram();
      const writeChunks: Buffer[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation(
        (chunk: unknown) => { writeChunks.push(Buffer.from(chunk as string)); return true; },
      );

      await program.parseAsync(['fetch', 'avfs://git/github.com/avfs-io/core/README.md?ref=main'], { from: 'user' });

      expect(fetch).toHaveBeenCalledTimes(1);
      const combinedOutput = Buffer.concat(writeChunks).toString('utf-8');
      expect(combinedOutput).toContain(SAMPLE_CONTENT);

      vi.restoreAllMocks();
    });

    it('should call GitHub Contents API with correct URL and raw Accept header', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, 'data'));

      const program = createProgram();
      // Use -o to avoid stdout pipeline hang in test environment
      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/test-owner/test-repo/src/index.ts?ref=main', '-o', '/dev/null'],
        { from: 'user' },
      );

      expect(fetch).toHaveBeenCalledTimes(1);
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('api.github.com/repos/test-owner/test-repo/contents/src%2Findex.ts');
      expect(calledUrl).toContain('ref=main');

      const calledInit = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
      expect((calledInit.headers as Record<string, string>).Accept).toBe('application/vnd.github.v3.raw');

      vi.restoreAllMocks();
    });
  });

  describe('-o output file option', () => {
    it('should write content to specified file when -o is provided', async () => {
      const outputPath = join(TEST_OUTPUT_DIR, 'readme-output.md');
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, SAMPLE_CONTENT));

      const program = createProgram();
      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/avfs-io/core/README.md?ref=main', '-o', outputPath],
        { from: 'user' },
      );

      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath, 'utf-8')).toBe(SAMPLE_CONTENT);
    });

    it('should handle --output long option', async () => {
      const outputPath = join(TEST_OUTPUT_DIR, 'long-opt.txt');
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, 'hello'));

      const program = createProgram();
      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/avfs-io/core/file.txt?ref=main', '--output', outputPath],
        { from: 'user' },
      );

      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath, 'utf-8')).toBe('hello');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Error cases: non-git protocol, invalid URI, API errors
  // ══════════════════════════════════════════════════════════════

  describe('non-git protocol error', () => {
    const protocols = ['file', 'http', 'https', 'smb'] as const;
    const examplePaths = [
      'avfs://file/home/user/config.json',
      'avfs://http/example.com/data.csv',
      'avfs://https/cdn.example.com/pkg.zip',
      'avfs://smb/10.0.0.1/share/doc.pdf',
    ];

    it.each(protocols)('should error on %s protocol with "not yet implemented" message', async (proto) => {
      const idx = protocols.indexOf(proto);
      const program = createProgram();
      const errorMessages: unknown[] = [];
      vi.spyOn(console, 'error').mockImplementation((...args) => { errorMessages.push(...args); });

      await program.parseAsync(['fetch', examplePaths[idx]], { from: 'user' });

      // Our action handler should output the "not yet implemented" message
      const combinedOutput = errorMessages.map(String).join(' ');
      expect(combinedOutput).toContain('not yet implemented');
      expect(combinedOutput).toContain(proto);
      expect(process.exitCode).toBe(1);

      vi.restoreAllMocks();
    });
  });

  describe('invalid AVFS address handling', () => {
    it('should error on invalid address format with exitCode=1', async () => {
      const program = createProgram();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await program.parseAsync(['fetch', 'not-an-avfs-address'], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid AVFS address'));
      expect(process.exitCode).toBe(1);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('API error responses', () => {
    it('should show friendly "File not found" message on 404', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(404, '{"message":"Not Found"}'));

      const program = createProgram();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/avfs-io/core/nonexistent.xyz?ref=main'],
        { from: 'user' },
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent.xyz'));
      expect(process.exitCode).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it('should show rate limit message on 403', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(403, '{"message":"rate limit"}'));

      const program = createProgram();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/avfs-io/core/README.md?ref=main'],
        { from: 'user' },
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit exceeded'));
      expect(process.exitCode).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it('should handle network timeout errors gracefully', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      vi.mocked(fetch).mockRejectedValue(abortError);

      const program = createProgram();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/avfs-io/core/README.md?ref=main'],
        { from: 'user' },
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Network error'));
      expect(process.exitCode).toBe(1);

      consoleErrorSpy.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Version handling
  // ══════════════════════════════════════════════════════════════

  describe('version in AVFS URI', () => {
    it('should pass version to driver connect when present', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, 'content'));
      const outputPath = join(TEST_OUTPUT_DIR, 'version-test.txt');

      const program = createProgram();
      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/owner/repo/path/file.ts?ref=v2.0.0', '-o', outputPath],
        { from: 'user' },
      );

      expect(fetch).toHaveBeenCalledTimes(1);
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain('ref=v2.0.0');

      vi.restoreAllMocks();
    });

    it('should work without version (default branch)', async () => {
      vi.mocked(fetch).mockResolvedValue(createMockResponse(200, 'no-version-content'));
      const outputPath = join(TEST_OUTPUT_DIR, 'no-version.txt');

      const program = createProgram();
      await program.parseAsync(
        ['fetch', 'avfs://git/github.com/owner/repo/file.txt?ref=main', '-o', outputPath],
        { from: 'user' },
      );

      expect(existsSync(outputPath)).toBe(true);
      // Verify fetch was called
      expect(fetch).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });
  });
});
