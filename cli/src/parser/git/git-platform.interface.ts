import type { GitPlatformType } from '../types.js';

/**
 * Result of splitting an AVFS URI path into resourceBase and filePath.
 */
export interface AvfsPathSplitResult {
  /** Resource base (e.g. "github.com/avfs-io/avfs-core") */
  resourceBase: string;
  /** File path within the repository, or null if absent */
  filePath: string | null;
}

/**
 * Git platform strategy interface.
 * Each platform (GitHub, GitLab, etc.) implements its own
 * URL detection, resourceBase extraction, and AVFS path splitting rules.
 */
export interface GitPlatform {
  /** Platform identifier */
  readonly name: GitPlatformType;

  /** Detect whether a native URL belongs to this platform */
  detect(nativeUrl: string): boolean;

  /** Extract resourceBase from a native URL (e.g. "github.com/owner/repo") */
  extractResourceBase(nativeUrl: string): string;

  /** Rebuild an HTTPS clone URL from resourceBase */
  buildCloneUrl(resourceBase: string): string;

  /**
   * Split an AVFS URI path (after protocol) into resourceBase and filePath.
   *
   * Each platform has its own resourceBase format:
   *   - GitHub:   github.com/{owner}/{repo}           → fixed 2 segments after host
   *   - GitLab:   gitlab.com/{group}/{...sub}/{repo}  → variable segments
   *   - Bitbucket: bitbucket.org/{workspace}/{repo}    → fixed 2 segments
   *
   * @param path - Full path after protocol, e.g. "github.com/avfs-io/avfs-core/docs/README.md"
   * @returns Split result with resourceBase and filePath
   */
  splitAvfsPath(path: string): AvfsPathSplitResult;
}
