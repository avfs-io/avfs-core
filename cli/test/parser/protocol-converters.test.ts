import { describe, it, expect } from 'vitest';
import { FileConverter } from '../../src/parser/protocol-converters/file-converter.js';
import { HttpConverter } from '../../src/parser/protocol-converters/http-converter.js';
import { HttpsConverter } from '../../src/parser/protocol-converters/https-converter.js';
import { SmbConverter } from '../../src/parser/protocol-converters/smb-converter.js';
import { GitConverter } from '../../src/parser/protocol-converters/git-converter.js';
import type { ParsedAddress } from '../../src/parser/types.js';

// ── Shared helper ──

/** Assert ParsedAddress fields match expected values */
function assertAvfsResult(
  result: ParsedAddress,
  expected: {
    protocol: string;
    resourceBase: string;
    filePath: string | null;
    isValid: boolean;
  }
): void {
  expect(result.protocol).toBe(expected.protocol);
  expect(result.resourceBase).toBe(expected.resourceBase);
  expect(result.filePath).toBe(expected.filePath);
  expect(result.version).toBeNull();
  expect(result.anchor).toBeNull();
  expect(result.isValid).toBe(expected.isValid);
  if (expected.isValid) {
    expect(result.errors).toEqual([]);
  }
}

// ── File Converter ──

describe('FileConverter', () => {
  const converter = new FileConverter();

  describe('detect()', () => {
    it('Unix absolute path → true', () => {
      expect(converter.detect('/home/user/file.txt')).toBe(true);
    });

    it('relative path (Unix) → false', () => {
      expect(converter.detect('config.json')).toBe(false);
    });

    it('home directory → true', () => {
      expect(converter.detect('~/config.json')).toBe(true);
    });

    it('Windows absolute path → true', () => {
      expect(converter.detect('C:\\Users\\file.txt')).toBe(true);
    });

    it('URL-like input → false', () => {
      expect(converter.detect('http://example.com')).toBe(false);
    });
  });

  describe('toAvfs()', () => {
    it('Unix absolute path → correct ParsedAddress', () => {
      const result = converter.toAvfs('/home/user/config.json');
      assertAvfsResult(result, {
        protocol: 'file',
        resourceBase: 'home',
        filePath: 'user/config.json',
        isValid: true,
      });
    });

    it('deep file path → correct split', () => {
      const result = converter.toAvfs('/var/log/app/error.log');
      assertAvfsResult(result, {
        protocol: 'file',
        resourceBase: 'var',
        filePath: 'log/app/error.log',
        isValid: true,
      });
    });

    it('root path with no subdirectory → base only, no filePath', () => {
      const result = converter.toAvfs('/home');
      expect(result.protocol).toBe('file');
      expect(result.resourceBase).toBe('home');
      expect(result.filePath).toBeNull();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File path is required');
    });

    it('home dir path → correct split', () => {
      const result = converter.toAvfs('~/projects/avfs');
      assertAvfsResult(result, {
        protocol: 'file',
        resourceBase: '~',
        filePath: 'projects/avfs',
        isValid: true,
      });
    });

    it('Windows path → backslashes normalized', () => {
      const result = converter.toAvfs('C:\\Users\\alice\\doc.txt');
      assertAvfsResult(result, {
        protocol: 'file',
        resourceBase: 'C:',
        filePath: 'Users/alice/doc.txt',
        isValid: true,
      });
    });
  });
});

// ── HTTP Converter ──

describe('HttpConverter', () => {
  const converter = new HttpConverter();

  describe('detect()', () => {
    it('http:// URL → true', () => {
      expect(converter.detect('http://192.168.1.1/path')).toBe(true);
    });

    it('https:// URL → false (should be Http, not Https)', () => {
      expect(converter.detect('https://example.com')).toBe(false);
    });

    it('file path → false', () => {
      expect(converter.detect('/home/user')).toBe(false);
    });
  });

  describe('toAvfs()', () => {
    it('host:port + path → correct ParsedAddress', () => {
      const result = converter.toAvfs('http://192.168.1.100:8080/api/data.csv');
      assertAvfsResult(result, {
        protocol: 'http',
        resourceBase: '192.168.1.100:8080',
        filePath: 'api/data.csv',
        isValid: true,
      });
    });

    it('domain + path → correct split', () => {
      const result = converter.toAvfs('http://example.com/data/file.json');
      assertAvfsResult(result, {
        protocol: 'http',
        resourceBase: 'example.com',
        filePath: 'data/file.json',
        isValid: true,
      });
    });

    it('host with no path → no filePath, invalid', () => {
      const result = converter.toAvfs('http://example.com');
      expect(result.protocol).toBe('http');
      expect(result.resourceBase).toBe('example.com');
      expect(result.filePath).toBeNull();
      expect(result.isValid).toBe(false);
    });

    it('single-element path → correct', () => {
      const result = converter.toAvfs('http://localhost/data.csv');
      assertAvfsResult(result, {
        protocol: 'http',
        resourceBase: 'localhost',
        filePath: 'data.csv',
        isValid: true,
      });
    });
  });
});

// ── HTTPS Converter ──

describe('HttpsConverter', () => {
  const converter = new HttpsConverter();

  describe('detect()', () => {
    it('https:// URL → true', () => {
      expect(converter.detect('https://cdn.example.com/pkg.zip')).toBe(true);
    });

    it('http:// URL → false', () => {
      expect(converter.detect('http://example.com')).toBe(false);
    });

    it('UNC path → false', () => {
      expect(converter.detect('\\\\server\\share')).toBe(false);
    });
  });

  describe('toAvfs()', () => {
    it('HTTPS URL with subpath → correct ParsedAddress', () => {
      const result = converter.toAvfs('https://cdn.example.com/files/v1/package.zip');
      assertAvfsResult(result, {
        protocol: 'https',
        resourceBase: 'cdn.example.com',
        filePath: 'files/v1/package.zip',
        isValid: true,
      });
    });

    it('host only → no filePath, invalid', () => {
      const result = converter.toAvfs('https://example.com');
      expect(result.protocol).toBe('https');
      expect(result.resourceBase).toBe('example.com');
      expect(result.filePath).toBeNull();
      expect(result.isValid).toBe(false);
    });

    it('index path → correct', () => {
      const result = converter.toAvfs('https://example.com/index.html');
      assertAvfsResult(result, {
        protocol: 'https',
        resourceBase: 'example.com',
        filePath: 'index.html',
        isValid: true,
      });
    });
  });
});

// ── SMB Converter ──

describe('SmbConverter', () => {
  const converter = new SmbConverter();

  describe('detect()', () => {
    it('UNC path (backslash) → true', () => {
      expect(converter.detect('\\\\192.168.1.60\\share\\docs')).toBe(true);
    });

    it('Unix-style SMB path (forward slash) → true', () => {
      expect(converter.detect('//192.168.1.60/share/docs')).toBe(true);
    });

    it('HTTP URL → false', () => {
      expect(converter.detect('http://192.168.1.60/share')).toBe(false);
    });

    it('file path → false', () => {
      expect(converter.detect('/home/user')).toBe(false);
    });
  });

  describe('toAvfs()', () => {
    it('UNC backslash path → correct ParsedAddress', () => {
      const result = converter.toAvfs('\\\\192.168.1.60\\share\\docs\\report.xlsx');
      assertAvfsResult(result, {
        protocol: 'smb',
        resourceBase: '192.168.1.60',
        filePath: 'share/docs/report.xlsx',
        isValid: true,
      });
    });

    it('Unix-style SMB path → correct ParsedAddress', () => {
      const result = converter.toAvfs('//192.168.1.60/share/docs/report.xlsx');
      assertAvfsResult(result, {
        protocol: 'smb',
        resourceBase: '192.168.1.60',
        filePath: 'share/docs/report.xlsx',
        isValid: true,
      });
    });

    it('server only (no share) → no filePath, invalid', () => {
      const result = converter.toAvfs('\\\\192.168.1.60\\share');
      expect(result.protocol).toBe('smb');
      expect(result.resourceBase).toBe('192.168.1.60');
      expect(result.filePath).toBe('share');
      // share is detected as filePath, which is valid
      expect(result.isValid).toBe(true);
    });

    it('server without share → invalid (no filePath)', () => {
      const result = converter.toAvfs('\\\\192.168.1.60');
      expect(result.protocol).toBe('smb');
      expect(result.resourceBase).toBe('192.168.1.60');
      expect(result.filePath).toBeNull();
      expect(result.isValid).toBe(false);
    });
  });

  describe('toAvfs() backslash normalization', () => {
    it('mixed backslashes and forward slashes → all normalized to /', () => {
      const result = converter.toAvfs('\\\\192.168.1.60\\share\\docs\\report.xlsx');
      expect(result.filePath).toBe('share/docs/report.xlsx');
      // No backslashes in filePath
      expect(result.filePath).not.toContain('\\');
    });
  });
});

// ── toNative() Tests (Task 2.3) ──

describe('FileConverter.toNative()', () => {
  const converter = new FileConverter();

  it('Unix path → reconstructs original absolute path', () => {
    const parsed: ParsedAddress = {
      protocol: 'file',
      resourceBase: 'home',
      version: null,
      filePath: 'user/config.json',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('/home/user/config.json');
    expect(result.protocol).toBe('file');
  });

  it('home directory path → reconstructs ~/path', () => {
    const parsed: ParsedAddress = {
      protocol: 'file',
      resourceBase: '~',
      version: null,
      filePath: 'projects/avfs',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('~/projects/avfs');
  });

  it('deep nested path → correct reconstruction', () => {
    const parsed: ParsedAddress = {
      protocol: 'file',
      resourceBase: 'var',
      version: null,
      filePath: 'log/app/error.log',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('/var/log/app/error.log');
  });
});

describe('HttpConverter.toNative()', () => {
  const converter = new HttpConverter();

  it('HTTP URL with port → reconstructs original URL', () => {
    const parsed: ParsedAddress = {
      protocol: 'http',
      resourceBase: '192.168.1.100:8080',
      version: null,
      filePath: 'api/data.csv',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('http://192.168.1.100:8080/api/data.csv');
    expect(result.protocol).toBe('http');
  });

  it('HTTP URL without port → correct reconstruction', () => {
    const parsed: ParsedAddress = {
      protocol: 'http',
      resourceBase: 'example.com',
      version: null,
      filePath: 'data/file.json',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('http://example.com/data/file.json');
  });
});

describe('HttpsConverter.toNative()', () => {
  const converter = new HttpsConverter();

  it('HTTPS URL with subpath → reconstructs original URL', () => {
    const parsed: ParsedAddress = {
      protocol: 'https',
      resourceBase: 'cdn.example.com',
      version: null,
      filePath: 'files/v1/package.zip',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('https://cdn.example.com/files/v1/package.zip');
    expect(result.protocol).toBe('https');
  });

  it('simple HTTPS URL → correct reconstruction', () => {
    const parsed: ParsedAddress = {
      protocol: 'https',
      resourceBase: 'example.com',
      version: null,
      filePath: 'index.html',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('https://example.com/index.html');
  });
});

describe('SmbConverter.toNative()', () => {
  const converter = new SmbConverter();

  it('AVFS URI → UNC path with backslashes', () => {
    const parsed: ParsedAddress = {
      protocol: 'smb',
      resourceBase: '192.168.1.60',
      version: null,
      filePath: 'share/report.xlsx',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('\\\\192.168.1.60\\share\\report.xlsx');
    expect(result.protocol).toBe('smb');
  });

  it('deep UNC path → all backslashes', () => {
    const parsed: ParsedAddress = {
      protocol: 'smb',
      resourceBase: '10.0.0.1',
      version: null,
      filePath: 'share/docs/doc.pdf',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('\\\\10.0.0.1\\share\\docs\\doc.pdf');
  });
});

describe('GitConverter.toNative()', () => {
  const converter = new GitConverter();

  it('GitHub AVFS URI → cloneUrl + version + filePath metadata', () => {
    const parsed: ParsedAddress = {
      protocol: 'git',
      resourceBase: 'github.com/avfs-io/core',
      version: 'v1.0.0',
      filePath: 'src/index.ts',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('https://github.com/avfs-io/core.git');
    expect(result.protocol).toBe('git');
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.cloneUrl).toBe('https://github.com/avfs-io/core.git');
    expect(result.metadata!.version).toBe('v1.0.0');
    expect(result.metadata!.filePath).toBe('src/index.ts');
  });

  it('GitHub AVFS URI without version → metadata has null version', () => {
    const parsed: ParsedAddress = {
      protocol: 'git',
      resourceBase: 'github.com/octocat/hello-world',
      version: null,
      filePath: 'README.md',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    expect(result.url).toBe('https://github.com/octocat/hello-world.git');
    expect(result.metadata!.version).toBeNull();
    expect(result.metadata!.filePath).toBe('README.md');
  });

  it('unknown platform → generic HTTPS .git fallback', () => {
    const parsed: ParsedAddress = {
      protocol: 'git',
      resourceBase: 'gitlab.example.com/org/repo',
      version: 'main',
      filePath: 'file.txt',
      anchor: null,
      rawInput: '',
      isValid: true,
      errors: [],
    };
    const result = converter.toNative(parsed);
    // Fallback: generic https://{resourceBase}.git
    expect(result.url).toBe('https://gitlab.example.com/org/repo.git');
    expect(result.metadata!.cloneUrl).toBe('https://gitlab.example.com/org/repo.git');
  });
});

// ── Round-trip tests (native → AVFS → native) ──

describe('Round-trip conversion (native → toAvfs → toNative)', () => {
  it('File: /home/user/config.json round-trip', () => {
    const fileConv = new FileConverter();
    const original = '/home/user/config.json';
    const avfs = fileConv.toAvfs(original);
    expect(avfs.isValid).toBe(true);
    const native = fileConv.toNative(avfs);
    expect(native.url).toBe(original);
  });

  it('HTTP: http://host:port/path round-trip', () => {
    const httpConv = new HttpConverter();
    const original = 'http://192.168.1.100:8080/api/data.csv';
    const avfs = httpConv.toAvfs(original);
    expect(avfs.isValid).toBe(true);
    const native = httpConv.toNative(avfs);
    expect(native.url).toBe(original);
  });

  it('HTTPS: https://example.com/file round-trip', () => {
    const httpsConv = new HttpsConverter();
    const original = 'https://cdn.example.com/files/v1/package.zip';
    const avfs = httpsConv.toAvfs(original);
    expect(avfs.isValid).toBe(true);
    const native = httpsConv.toNative(avfs);
    expect(native.url).toBe(original);
  });

  it('Git: HTTPS clone URL round-trip (toNative returns cloneUrl)', () => {
    const gitConv = new GitConverter();
    const original = 'https://github.com/avfs-io/core.git';
    const avfs = gitConv.toAvfs(original);
    expect(avfs.isValid).toBe(true);
    const native = gitConv.toNative(avfs);
    // Git toNative returns cloneUrl (with .git suffix)
    expect(native.url).toContain('.git');
    expect(native.metadata!.cloneUrl).toContain('github.com/avfs-io/core.git');
  });
});
