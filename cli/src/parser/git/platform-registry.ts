import type { GitPlatformType } from '../types.js';
import type { GitPlatform } from './git-platform.interface.js';
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
   * Get all registered platform names.
   */
  getRegisteredPlatforms(): GitPlatformType[] {
    return this.platforms.map((p) => p.name);
  }
}
