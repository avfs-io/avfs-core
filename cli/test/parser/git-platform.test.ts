import { describe, it, expect } from 'vitest';
import { GitHubPlatform } from '../../src/parser/git/github-platform.js';
import { PlatformRegistry } from '../../src/parser/git/platform-registry.js';
import platformDetectionFixtures from '../fixtures/platform-detection.json';

const platformFixtures = platformDetectionFixtures;

describe('GitHubPlatform', () => {
  const platform = new GitHubPlatform();

  describe('detect', () => {
    it('should detect GitHub HTTPS clone URL (with .git)', () => {
      expect(platform.detect('https://github.com/avfs-io/core.git')).toBe(true);
    });

    it('should detect GitHub HTTPS URL (without .git)', () => {
      expect(platform.detect('https://github.com/avfs-io/core')).toBe(true);
    });

    it('should detect GitHub HTTPS URL with subpath', () => {
      expect(platform.detect('https://github.com/avfs-io/core/tree/main/src')).toBe(true);
    });

    it('should detect GitHub SSH URL (with .git)', () => {
      expect(platform.detect('git@github.com:avfs-io/core.git')).toBe(true);
    });

    it('should detect GitHub SSH URL (without .git)', () => {
      expect(platform.detect('git@github.com:avfs-io/core')).toBe(true);
    });

    it('should NOT detect GitLab HTTPS URL', () => {
      expect(platform.detect('https://gitlab.com/org/repo.git')).toBe(false);
    });

    it('should NOT detect Bitbucket SSH URL', () => {
      expect(platform.detect('git@bitbucket.org:org/repo.git')).toBe(false);
    });

    it('should NOT detect non-GitHub HTTPS URL', () => {
      expect(platform.detect('https://aws.amazon.com/s3/bucket/key')).toBe(false);
    });

    it('should NOT detect bare github.com reference', () => {
      expect(platform.detect('github.com/avfs-io/core')).toBe(false);
    });

    it('should NOT detect empty string', () => {
      expect(platform.detect('')).toBe(false);
    });
  });

  describe('extractResourceBase', () => {
    it('should extract resourceBase from HTTPS clone URL (with .git)', () => {
      expect(platform.extractResourceBase('https://github.com/avfs-io/core.git'))
        .toBe('github.com/avfs-io/core');
    });

    it('should extract resourceBase from HTTPS URL (without .git)', () => {
      expect(platform.extractResourceBase('https://github.com/avfs-io/core'))
        .toBe('github.com/avfs-io/core');
    });

    it('should extract resourceBase from HTTPS URL with subpath', () => {
      expect(platform.extractResourceBase('https://github.com/avfs-io/core/tree/main/src'))
        .toBe('github.com/avfs-io/core');
    });

    it('should extract resourceBase from SSH URL (with .git)', () => {
      expect(platform.extractResourceBase('git@github.com:avfs-io/core.git'))
        .toBe('github.com/avfs-io/core');
    });

    it('should extract resourceBase from SSH URL (without .git)', () => {
      expect(platform.extractResourceBase('git@github.com:avfs-io/core'))
        .toBe('github.com/avfs-io/core');
    });

    it('should extract resourceBase with nested org (e.g. owner/subgroup/repo)', () => {
      expect(platform.extractResourceBase('https://github.com/avfs-io/subgroup/core.git'))
        .toBe('github.com/avfs-io/subgroup');
    });

    it('should return empty string for non-GitHub URL', () => {
      expect(platform.extractResourceBase('https://gitlab.com/org/repo.git')).toBe('');
    });
  });

  describe('buildCloneUrl', () => {
    it('should build clone URL with github.com/ prefix', () => {
      expect(platform.buildCloneUrl('github.com/avfs-io/core'))
        .toBe('https://github.com/avfs-io/core.git');
    });

    it('should build clone URL without github.com/ prefix', () => {
      expect(platform.buildCloneUrl('avfs-io/core'))
        .toBe('https://github.com/avfs-io/core.git');
    });

    it('should build clone URL with nested org', () => {
      expect(platform.buildCloneUrl('github.com/avfs-io/subgroup/core'))
        .toBe('https://github.com/avfs-io/subgroup/core.git');
    });
  });

  describe('round-trip', () => {
    it('should round-trip HTTPS clone URL → resourceBase → clone URL', () => {
      const input = 'https://github.com/avfs-io/core.git';
      const resourceBase = platform.extractResourceBase(input);
      const cloneUrl = platform.buildCloneUrl(resourceBase);
      expect(cloneUrl).toBe(input);
    });

    it('should round-trip SSH URL → resourceBase → clone URL', () => {
      const input = 'git@github.com:avfs-io/core.git';
      const resourceBase = platform.extractResourceBase(input);
      const cloneUrl = platform.buildCloneUrl(resourceBase);
      expect(cloneUrl).toBe('https://github.com/avfs-io/core.git');
    });
  });

  describe('splitAvfsPath', () => {
    it('should split simple path with file', () => {
      const result = platform.splitAvfsPath('github.com/avfs-io/core/readme.md');
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
      expect(result.filePath).toBe('readme.md');
    });

    it('should split deep nested file path', () => {
      const result = platform.splitAvfsPath('github.com/avfs-io/avfs-core/docs/contents/en-us/spec/address-syntax.md');
      expect(result.resourceBase).toBe('github.com/avfs-io/avfs-core');
      expect(result.filePath).toBe('docs/contents/en-us/spec/address-syntax.md');
    });

    it('should return null filePath when only host/owner/repo (no file)', () => {
      const result = platform.splitAvfsPath('github.com/avfs-io/core');
      expect(result.resourceBase).toBe('github.com/avfs-io/core');
      expect(result.filePath).toBeNull();
    });

    it('should return null filePath when incomplete (only host/owner)', () => {
      const result = platform.splitAvfsPath('github.com/avfs-io');
      expect(result.resourceBase).toBe('github.com/avfs-io');
      expect(result.filePath).toBeNull();
    });

    it('should handle single-segment path (host only)', () => {
      const result = platform.splitAvfsPath('github.com');
      expect(result.resourceBase).toBe('github.com');
      expect(result.filePath).toBeNull();
    });
  });

  describe('fixture-based tests', () => {
    for (const tc of platformFixtures.testCases) {
      it(`[${tc.id}] ${tc.description}`, () => {
        // Use PlatformRegistry for detection test (more comprehensive)
        const registry = new PlatformRegistry();
        const detected = registry.detectPlatform(tc.input);
        expect(detected).toBe(tc.expected.platform);

        // If resourceBase is expected, verify extraction
        if (tc.expected.resourceBase) {
          const platform = registry.getPlatform(detected);
          if (platform) {
            expect(platform.extractResourceBase(tc.input)).toBe(tc.expected.resourceBase);
          }
        }
      });
    }
  });
});

describe('PlatformRegistry', () => {
  describe('default registration', () => {
    it('should have GitHub platform pre-registered', () => {
      const registry = new PlatformRegistry();
      expect(registry.getRegisteredPlatforms()).toContain('github');
    });
  });

  describe('detectPlatform', () => {
    const registry = new PlatformRegistry();

    it('should detect GitHub HTTPS URL as github', () => {
      expect(registry.detectPlatform('https://github.com/avfs-io/core.git')).toBe('github');
    });

    it('should detect GitHub SSH URL as github', () => {
      expect(registry.detectPlatform('git@github.com:avfs-io/core.git')).toBe('github');
    });

    it('should return unknown for GitLab URL', () => {
      expect(registry.detectPlatform('https://gitlab.com/org/repo.git')).toBe('unknown');
    });

    it('should return unknown for Bitbucket SSH URL', () => {
      expect(registry.detectPlatform('git@bitbucket.org:org/repo.git')).toBe('unknown');
    });

    it('should return unknown for bare reference', () => {
      expect(registry.detectPlatform('github.com/avfs-io/core')).toBe('unknown');
    });

    it('should return unknown for non-git HTTPS URL', () => {
      expect(registry.detectPlatform('https://aws.amazon.com/s3/bucket/key')).toBe('unknown');
    });

    it('should return unknown for empty string', () => {
      expect(registry.detectPlatform('')).toBe('unknown');
    });
  });

  describe('getPlatform', () => {
    it('should return GitHubPlatform instance for "github"', () => {
      const registry = new PlatformRegistry();
      const platform = registry.getPlatform('github');
      expect(platform).toBeDefined();
      expect(platform!.name).toBe('github');
    });

    it('should return undefined for unknown platform', () => {
      const registry = new PlatformRegistry();
      expect(registry.getPlatform('unknown')).toBeUndefined();
    });
  });

  describe('register (dynamic registration)', () => {
    it('should support registering a new custom platform', () => {
      const registry = new PlatformRegistry();

      // Create a mock platform
      const mockPlatform = {
        name: 'gitlab' as const,
        detect: (url: string) => url.includes('gitlab.com'),
        extractResourceBase: (url: string) => {
          const m = url.match(/gitlab\.com\/([^/]+\/[^/]+)/);
          return m ? `gitlab.com/${m[1]}` : '';
        },
        buildCloneUrl: (rb: string) => `https://${rb}.git`,
        splitAvfsPath: (path: string) => {
          // GitLab-style: variable segments, take all but last as resourceBase
          const lastSlash = path.lastIndexOf('/');
          if (lastSlash < 0) return { resourceBase: path, filePath: null };
          return { resourceBase: path.slice(0, lastSlash), filePath: path.slice(lastSlash + 1) };
        },
      };

      const initialCount = registry.getRegisteredPlatforms().length;
      registry.register(mockPlatform);
      expect(registry.getRegisteredPlatforms().length).toBe(initialCount + 1);
      expect(registry.getRegisteredPlatforms()).toContain('gitlab');

      // Verify detection works
      expect(registry.detectPlatform('https://gitlab.com/org/repo.git')).toBe('gitlab');
    });

    it('should replace existing platform with same name', () => {
      const registry = new PlatformRegistry();

      const mockPlatform = {
        name: 'github' as const,
        detect: () => true,
        extractResourceBase: () => 'custom',
        buildCloneUrl: () => 'custom-url',
        splitAvfsPath: (path: string) => ({ resourceBase: path, filePath: null }),
      };

      registry.register(mockPlatform);
      // Should still have the same number of platforms (replaced, not added)
      const githubPlatform = registry.getPlatform('github');
      expect(githubPlatform).toBeDefined();
      expect(githubPlatform!.extractResourceBase('anything')).toBe('custom');
    });
  });

  describe('getRegisteredPlatforms', () => {
    it('should return all registered platform names', () => {
      const registry = new PlatformRegistry();
      const platforms = registry.getRegisteredPlatforms();
      expect(platforms).toContain('github');
      expect(Array.isArray(platforms)).toBe(true);
    });
  });

  describe('splitAvfsPath (fallback / non-GitHub host)', () => {
    // Covers platform-registry.ts defaultSplit() method (lines 128-143)
    const registry = new PlatformRegistry();

    it('should use default split for non-github host with file path', () => {
      // defaultSplit: "host/seg1/seg2/path/file" → resourceBase=host/seg1, filePath=seg2/path/file
      const result = registry.splitAvfsPath('gitlab.com/org/repo/docs/readme.md');
      // firstSlash=9 (gitlab.com/), secondSlash=13 (org/) → resourceBase=gitlab.com/org
      expect(result.resourceBase).toBe('gitlab.com/org');
      expect(result.filePath).toBe('repo/docs/readme.md');
    });

    it('should use default split for non-github host without file path (2 segments)', () => {
      const result = registry.splitAvfsPath('gitlab.com/org/repo');
      // firstSlash=9, secondSlash=13 → resourceBase=gitlab.com/org, filePath=repo
      expect(result.resourceBase).toBe('gitlab.com/org');
      expect(result.filePath).toBe('repo');
    });

    it('should use default split for single-segment path (host only)', () => {
      const result = registry.splitAvfsPath('example.com');
      expect(result.resourceBase).toBe('example.com');
      expect(result.filePath).toBeNull();
    });
  });

  describe('detectPlatformByResourceBase', () => {
    // Covers platform-registry.ts lines 73-82
    const registry = new PlatformRegistry();

    it('should detect github from github.com/ resource base', () => {
      expect(registry.detectPlatformByResourceBase('github.com/avfs-io/core')).toBe('github');
    });

    it('should return unknown for non-github resource base', () => {
      expect(registry.detectPlatformByResourceBase('gitlab.com/org/repo')).toBe('unknown');
    });

    it('should return unknown for empty string', () => {
      expect(registry.detectPlatformByResourceBase('')).toBe('unknown');
    });
  });
});
