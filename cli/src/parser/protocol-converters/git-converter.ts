import type { ParsedAddress, NativeUrl, ProtocolType } from '../types.js';
import type { ProtocolConverter } from './converter.interface.js';
import { PlatformRegistry } from '../git/platform-registry.js';

/**
 * Git protocol converter — native Git URLs ↔ avfs://git/...
 *
 * Delegates platform detection and resourceBase extraction to
 * PlatformRegistry, which dispatches to registered GitPlatform
 * implementations (e.g. GitHubPlatform).
 *
 * Supported native URL formats (via registered platforms):
 *  - HTTPS clone:  https://github.com/{owner}/{repo}[.git][/subpath]
 *  - SSH clone:    git@github.com:{owner}/{repo}[.git][/subpath]
 */
export class GitConverter implements ProtocolConverter {
  readonly protocol: ProtocolType = 'git';

  private readonly platformRegistry: PlatformRegistry;

  constructor(platformRegistry?: PlatformRegistry) {
    this.platformRegistry = platformRegistry ?? new PlatformRegistry();
  }

  /**
   * Detect if nativeInput is a recognized Git URL.
   *
   * Delegates to PlatformRegistry.detectPlatform() — returns true
   * if any registered platform recognizes the URL.
   */
  detect(nativeInput: string): boolean {
    return this.platformRegistry.detectPlatform(nativeInput) !== 'unknown';
  }

  /**
   * Convert native Git URL → AVFS URI.
   *
   * Uses PlatformRegistry to detect the platform, then extracts
   * resourceBase via the matched platform's extractResourceBase().
   *
   * Examples:
   *   https://github.com/avfs-io/core.git     → avfs://git/github.com/avfs-io/core
   *   git@github.com:avfs-io/core.git         → avfs://git/github.com/avfs-io/core
   *
   * Note: toAvfs() returns resourceBase only (no filePath/version/anchor).
   *       The convert command builds the final AVFS URI string.
   */
  toAvfs(nativeInput: string): ParsedAddress {
    // Detect platform
    const platformType = this.platformRegistry.detectPlatform(nativeInput);

    // Extract resourceBase via matched platform
    let resourceBase: string;
    if (platformType !== 'unknown') {
      const platform = this.platformRegistry.getPlatform(platformType);
      resourceBase = platform!.extractResourceBase(nativeInput);
    } else {
      // Fallback: unknown platform — attempt to parse generically
      resourceBase = this.extractResourceBaseGeneric(nativeInput);
    }

    const errors: string[] = [];
    if (!resourceBase) errors.push('Failed to extract resourceBase from Git URL');

    return {
      protocol: 'git',
      resourceBase,
      version: null,
      filePath: null,
      anchor: null,
      rawInput: nativeInput,
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert AVFS URI → native Git URL (clone URL).
   *
   * Uses PlatformRegistry to detect platform and buildCloneUrl().
   * Returns a structured result with cloneUrl, version, and filePath.
   *
   * Examples:
   *   avfs://git/github.com/avfs-io/core/path/file.ts?ref=v1.0.0
   *     → { url: "https://github.com/avfs-io/core.git",
   *          metadata: { cloneUrl: "https://github.com/avfs-io/core.git",
   *                      version: "v1.0.0",
   *                      filePath: "path/file.ts" } }
   */
  toNative(parsed: ParsedAddress): NativeUrl {
    // Guard against incomplete input — resourceBase is required
    if (!parsed?.resourceBase) {
      throw new Error('GitConverter.toNative() is not yet implemented');
    }

    // Try to find a registered platform that can build the clone URL
    let cloneUrl: string;

    // Check if resourceBase starts with a known platform host pattern
    const platformType = this.platformRegistry.detectPlatformByResourceBase(parsed.resourceBase);
    if (platformType !== 'unknown') {
      const platform = this.platformRegistry.getPlatform(platformType);
      cloneUrl = platform!.buildCloneUrl(parsed.resourceBase);
    } else {
      // Fallback: generic HTTPS .git URL construction
      cloneUrl = `https://${parsed.resourceBase}.git`;
    }

    return {
      url: cloneUrl,
      protocol: 'git',
      metadata: {
        cloneUrl,
        version: parsed.version,
        filePath: parsed.filePath,
      },
    };
  }

  /**
   * Generic resourceBase extraction for unrecognized Git platforms.
   * Strips protocol/prefix and .git suffix to produce a best-effort
   * resourceBase string.
   */
  private extractResourceBaseGeneric(nativeInput: string): string {
    // HTTPS pattern: https://host/org/repo[.git][/...]
    let base = nativeInput.replace(/^https?:\/\//, '');
    // SSH pattern: git@host:org/repo[.git][/...]
    base = base.replace(/^git@/, '').replace(/:/, '/');
    // Remove trailing .git and everything after
    base = base.replace(/\.git(?:\/.*)?$/, '');
    // Remove subpath after owner/repo if present
    // Match: host/owner/repo (2 path segments after host)
    const match = base.match(/^([^/]+\/[^/]+\/[^/]+)/);
    return match ? match[1] : base;
  }
}
