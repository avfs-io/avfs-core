import type { GitPlatformType } from '../types.js';
import type { GitPlatform, AvfsPathSplitResult } from './git-platform.interface.js';
import { GitHubPlatform } from './github-platform.js';

/**
 * Platform registry for managing Git platform strategies.
 *
 * Maintains a list of registered platforms and provides
 * detection/lookup capabilities. By default, GitHubPlatform
 * is pre-registered.
 *
 * Additional platforms (GitLab, Bitbucket, etc.) can be
 * registered at runtime via register().
 */
export class PlatformRegistry {
  private platforms: GitPlatform[] = [];

  constructor() {
    // Pre-register GitHub platform
    this.register(new GitHubPlatform());
  }

  /**
   * Register a new platform strategy.
   * If a platform with the same name already exists, it is replaced.
   */
  register(platform: GitPlatform): void {
    const idx = this.platforms.findIndex((p) => p.name === platform.name);
    if (idx >= 0) {
      this.platforms[idx] = platform;
    } else {
      this.platforms.push(platform);
    }
  }

  /**
   * Detect which platform a native Git URL belongs to.
   *
   * Iterates all registered platforms and returns the name
   * of the first one whose detect() returns true.
   *
   * @returns Platform name, or 'unknown' if no platform matches.
   */
  detectPlatform(nativeUrl: string): GitPlatformType {
    for (const platform of this.platforms) {
      if (platform.detect(nativeUrl)) {
        return platform.name;
      }
    }
    return 'unknown';
  }

  /**
   * Get a platform by name.
   *
   * @returns The platform instance, or undefined if not registered.
   */
  getPlatform(name: GitPlatformType): GitPlatform | undefined {
    return this.platforms.find((p) => p.name === name);
  }

  /**
   * Detect which platform a resourceBase belongs to.
   *
   * Iterates all registered platforms and attempts to build a clone URL.
   * Returns the name of the first platform whose resourceBase pattern matches
   * (i.e. buildCloneUrl produces a valid URL).
   *
   * For GitHub: resourceBase starting with "github.com/" matches.
   *
   * @returns Platform name, or 'unknown' if no platform matches.
   */
  detectPlatformByResourceBase(resourceBase: string): GitPlatformType {
    for (const platform of this.platforms) {
      // For GitHubPlatform: check if resourceBase starts with "github.com/"
      if (platform.name === 'github' && resourceBase.startsWith('github.com/')) {
        return 'github';
      }
      // Future platforms can be added here with their own matching logic
    }
    return 'unknown';
  }

  /**
   * Split an AVFS URI path using platform-aware rules.
   *
   * Tries each registered platform in order to find one whose host
   * matches the path prefix, then delegates to its splitAvfsPath().
   * If no platform matches, falls back to a default "first slash" strategy.
   *
   * @param path - Full path after protocol, e.g. "github.com/avfs-io/avfs-core/docs/README.md"
   * @returns Split result with resourceBase and filePath
   */
  splitAvfsPath(path: string): AvfsPathSplitResult {
    // Try each registered platform to see if its host matches
    for (const platform of this.platforms) {
      const result = this.tryPlatformSplit(platform, path);
      if (result !== null) return result;
    }

    // Fallback: use simple first-slash-after-host heuristic
    return this.defaultSplit(path);
  }

  /**
   * Attempt to split using a specific platform's host pattern.
   * @returns Split result if the platform's host matches, null otherwise.
   */
  private tryPlatformSplit(platform: GitPlatform, path: string): AvfsPathSplitResult | null {
    // Extract host from path (everything before first /)
    const firstSlash = path.indexOf('/');
    if (firstSlash < 0) return null;
    const host = path.slice(0, firstSlash);

    // For GitHub: check if path starts with "github.com/"
    if (platform.name === 'github' && host.toLowerCase() === 'github.com') {
      return platform.splitAvfsPath(path);
    }
    // Future platforms: add their host matching logic here

    return null;
  }

  /**
   * Default fallback split when no platform matches.
   * Uses "host + next segment = resourceBase" heuristic.
   */
  private defaultSplit(path: string): AvfsPathSplitResult {
    const firstSlash = path.indexOf('/');
    if (firstSlash < 0) {
      return { resourceBase: path, filePath: null };
    }

    const secondSlash = path.indexOf('/', firstSlash + 1);
    if (secondSlash < 0) {
      return { resourceBase: path, filePath: null };
    }

    return {
      resourceBase: path.slice(0, secondSlash),
      filePath: path.slice(secondSlash + 1),
    };
  }

  /**
   * Get all registered platform names.
   */
  getRegisteredPlatforms(): GitPlatformType[] {
    return this.platforms.map((p) => p.name);
  }
}
