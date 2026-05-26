import { describe, it, expect } from 'vitest';
import { parseAvfsUri, validateAvfsUri } from '../../src/parser/index.js';

// Load fixtures
import validUris from '../fixtures/addressing/valid-uris.json' with { type: 'json' };
import invalidUris from '../fixtures/addressing/invalid-uris.json' with { type: 'json' };

interface ValidTestCase {
  id: string;
  description: string;
  input: string;
  expected: {
    protocol: string;
    resourceBase: string;
    version: string | null;
    filePath: string;
    anchor: string | null;
    isValid: boolean;
  };
  tags: string[];
}

interface InvalidTestCase {
  id: string;
  description: string;
  input: string;
  expected: {
    isValid: boolean;
    hasError: string;
  };
  tags: string[];
}

describe('uri-parser — parseAvfsUri', () => {
  describe('valid URIs (from fixtures)', () => {
    const cases = (validUris as { testCases: ValidTestCase[] }).testCases;
    for (const tc of cases) {
      it(`[${tc.id}] ${tc.description}`, () => {
        const result = parseAvfsUri(tc.input);

        expect(result.rawInput).toBe(tc.input);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.protocol).toBe(tc.expected.protocol);
        expect(result.resourceBase).toBe(tc.expected.resourceBase);
        expect(result.version).toBe(tc.expected.version);
        expect(result.filePath).toBe(tc.expected.filePath);
        expect(result.anchor).toBe(tc.expected.anchor);
      });
    }
  });

  describe('invalid URIs (from fixtures)', () => {
    const cases = (invalidUris as { testCases: InvalidTestCase[] }).testCases;
    for (const tc of cases) {
      it(`[${tc.id}] ${tc.description}`, () => {
        const result = parseAvfsUri(tc.input);

        expect(result.rawInput).toBe(tc.input);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(1);

        // Check that at least one error contains the expected substring
        const hasExpectedError = result.errors.some((err) =>
          err.includes(tc.expected.hasError)
        );
        expect(hasExpectedError).toBe(true);
      });
    }
  });

  describe('boundary conditions', () => {
    it('empty string → prefix error', () => {
      const result = parseAvfsUri('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Address must start with 'avfs://'");
    });

    it('only "avfs://" prefix → empty-body error', () => {
      const result = parseAvfsUri('avfs://');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address is empty after prefix');
    });

    it('only "avfs://git" → file path required error', () => {
      const result = parseAvfsUri('avfs://git');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File path is required');
    });

    it('only "avfs://file" → file path required error', () => {
      const result = parseAvfsUri('avfs://file');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File path is required');
    });

    it('git with version but no filePath → specific error', () => {
      const result = parseAvfsUri('avfs://git/github.com/avfs-io/core@main');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'File path is required when version is specified'
      );
      expect(result.version).toBe('main');
      expect(result.filePath).toBeNull();
    });

    it('only "avfs://file/" → missing resource base error', () => {
      const result = parseAvfsUri('avfs://file/');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing resource base');
    });

    it('unsupported protocol (ftp) → unsupported error', () => {
      const result = parseAvfsUri('avfs://ftp/host/path/file.txt');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unsupported protocol: 'ftp'");
    });

    it('uppercase protocol (FILE) → lowercased to file, which is valid', () => {
      // Per PRD §3.3.1 Step 4: protocol is lowercased before checking
      const result = parseAvfsUri('avfs://FILE/home/user/test.txt');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('file');
      expect(result.resourceBase).toBe('home');
      expect(result.filePath).toBe('user/test.txt');
    });

    it('protocol with special chars (git_hub) → unsupported error', () => {
      const result = parseAvfsUri('avfs://git_hub/host/path');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unsupported protocol: 'git_hub'");
    });
  });
});

describe('uri-parser — validateAvfsUri', () => {
  it('valid address → valid=true with address', () => {
    const result = validateAvfsUri(
      'avfs://git/github.com/avfs-io/core@main/readme.md'
    );
    expect(result.valid).toBe(true);
    expect(result.address).toBeDefined();
    expect(result.address!.protocol).toBe('git');
    expect(result.address!.resourceBase).toBe('github.com/avfs-io/core');
    expect(result.address!.version).toBe('main');
    expect(result.address!.filePath).toBe('readme.md');
  });

  it('invalid address → valid=false with errors', () => {
    const result = validateAvfsUri('not-an-avfs-address');
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThanOrEqual(1);
  });
});
