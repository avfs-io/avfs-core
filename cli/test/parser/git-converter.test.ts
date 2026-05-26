import { describe, it, expect } from 'vitest';
import { GitConverter } from '../../src/parser/protocol-converters/git-converter.js';
import { PlatformRegistry } from '../../src/parser/git/platform-registry.js';
import type { GitPlatform } from '../../src/parser/git/git-platform.interface.js';

// ── Helpers ──────────────────────────────────────────────────────

/** Load git-conversion.json test cases */
function loadConversionFixtures() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data = require('../fixtures/git-conversion.json');
  return data.testCases;
}

// ── Tests ────────────────────────────────────────────────────────

describe('GitConverter', () => {
  const registry = new PlatformRegistry();
  const converter = new GitConverter(registry);

  describe('detect()', () => {
    it('should detect GitHub HTTPS clone URL', () => {
      expect(converter.detect('https://github.com/avfs-io/core.git')).toBe(true);
    });

    it('should detect GitHub HTTPS URL without .git', () => {
      expect(converter.detect('https://github.com/avfs-io/core')).toBe(true);
    });

    it('should detect GitHub SSH URL', () => {
      expect(converter.detect('git@github.com:avfs-io/core.git')).toBe(true);
    });

    it('should detect GitHub SSH URL without .git', () => {
      expect(converter.detect('git@github.com:avfs-io/core')).toBe(true);
    });

    it('should not detect non-Git URLs', () => {
      expect(converter.detect('https://cdn.example.com/pkg.zip')).toBe(false);
      expect(converter.detect('/home/user/file.txt')).toBe(false);
      expect(converter.detect('http://example.com/data.csv')).toBe(false);
      expect(converter.detect('\\\\192.168.1.60\\share\\file')).toBe(false);
    });

    it('should not detect empty string', () => {
      expect(converter.detect('')).toBe(false);
    });
  });

  describe('toAvfs() — HTTPS URLs', () => {
    it('should convert HTTPS URL with .git suffix', () => {
      const result = converter.toAvfs('https://github.com/avfs-io/core.git');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('git');
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
    });

    it('should convert HTTPS URL without .git suffix', () => {
      const result = converter.toAvfs('https://github.com/avfs-io/core');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('git');
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
    });

    it('should convert HTTPS URL with subpath (strip subpath)', () => {
      const result = converter.toAvfs('https://github.com/avfs-io/core.git/path/file.ts');
      expect(result.isValid).toBe(true);
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
    });

    it('should convert third-party GitHub HTTPS URL', () => {
      const result = converter.toAvfs('https://github.com/microsoft/vscode.git');
      expect(result.isValid).toBe(true);
      expect(result.resourceBase).toBe('github.com/microsoft/vscode');
    });
  });

  describe('toAvfs() — SSH URLs', () => {
    it('should convert SSH URL with .git suffix', () => {
      const result = converter.toAvfs('git@github.com:avfs-io/core.git');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('git');
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
    });

    it('should convert SSH URL without .git suffix', () => {
      const result = converter.toAvfs('git@github.com:avfs-io/core');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('git');
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
    });

    it('should convert SSH URL with subpath (strip subpath)', () => {
      const result = converter.toAvfs('git@github.com:avfs-io/core.git/src/main.ts');
      expect(result.isValid).toBe(true);
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
    });
  });

  describe('toAvfs() — JSON fixture-driven', () => {
    const fixtures = loadConversionFixtures();

    fixtures.forEach((tc: any) => {
      it(`#${tc.id}: ${tc.description}`, () => {
        const result = converter.toAvfs(tc.input);
        expect(result.isValid).toBe(true);
        expect(result.protocol).toBe('git');
        expect(result.resourceBase).toBe(tc.expected.resourceBase);
      });
    });
  });

  describe('toAvfs() — error cases', () => {
    it('should mark invalid for non-git input', () => {
      const result = converter.toAvfs('');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('toNative()', () => {
    it('should throw "not yet implemented"', () => {
      expect(() => converter.toNative({} as any)).toThrow('not yet implemented');
    });
  });

  describe('custom PlatformRegistry', () => {
    it('should use custom registry when provided', () => {
      // Create a mock platform
      const mockPlatform: GitPlatform = {
        name: 'github',
        detect: (url: string) => url.includes('github.com'),
        extractResourceBase: () => 'github.com/test/repo',
        buildCloneUrl: () => 'https://github.com/test/repo.git',
      };

      const customRegistry = new PlatformRegistry();
      customRegistry.register(mockPlatform);

      const customConverter = new GitConverter(customRegistry);
      const result = customConverter.toAvfs('https://github.com/test/repo.git');
      expect(result.isValid).toBe(true);
      expect(result.resourceBase).toBe('github.com/test/repo');
    });
  });
});
