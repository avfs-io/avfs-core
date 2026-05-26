import type { GitPlatform, AvfsPathSplitResult } from './git-platform.interface.js';

/**
 * GitHub platform implementation.
 *
 * Supports two native URL formats:
 * - HTTPS clone:  https://github.com/{owner}/{repo}[.git][/subpath]
 * - SSH clone:    git@github.com:{owner}/{repo}[.git][/subpath]
 *
 * ResourceBase format: github.com/{owner}/{repo} (exactly 2 segments after host)
 */
export class GitHubPlatform implements GitPlatform {
  readonly name = 'github';

  /** HTTPS GitHub URL pattern */
  private static readonly HTTPS_PATTERN =
    /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/;

  /** SSH GitHub URL pattern */
  private static readonly SSH_PATTERN =
    /^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/;

  /**
   * Detect whether a native URL is a GitHub repository URL.
   */
  detect(nativeUrl: string): boolean {
    if (GitHubPlatform.HTTPS_PATTERN.test(nativeUrl)) return true;
    if (GitHubPlatform.SSH_PATTERN.test(nativeUrl)) return true;
    return false;
  }

  /**
   * Extract resourceBase from a GitHub native URL.
   *
   * - Strips protocol prefix (https://github.com/ or git@github.com:)
   * - Removes .git suffix if present
   * - Removes any subpath after owner/repo
   * - Returns "github.com/{owner}/{repo}" format
   */
  extractResourceBase(nativeUrl: string): string {
    // Try HTTPS first
    const httpsMatch = nativeUrl.match(GitHubPlatform.HTTPS_PATTERN);
    if (httpsMatch) {
      return `github.com/${httpsMatch[1]}`;
    }

    // Try SSH
    const sshMatch = nativeUrl.match(GitHubPlatform.SSH_PATTERN);
    if (sshMatch) {
      return `github.com/${sshMatch[1]}`;
    }

    // Fallback: should not reach here if detect() was called first
    return '';
  }

  /**
   * Build an HTTPS clone URL from resourceBase.
   *
   * Input:  "github.com/avfs-io/core"
   * Output: "https://github.com/avfs-io/core.git"
   */
  buildCloneUrl(resourceBase: string): string {
    // Strip "github.com/" prefix if present to get owner/repo
    const repoPath = resourceBase.startsWith('github.com/')
      ? resourceBase.slice('github.com/'.length)
      : resourceBase;
    return `https://github.com/${repoPath}.git`;
  }

  /**
   * Split AVFS URI path into resourceBase and filePath for GitHub.
   *
   * GitHub resourceBase format: github.com/{owner}/{repo}
   * → exactly 3 segments total (host + owner + repo), separated by 2 slashes
   *
   * The boundary between resourceBase and filePath is the 3rd slash
   * (i.e., everything through host/owner/repo is resourceBase).
   *
   * Key distinction:
   *   - ≤ 2 slashes (host/owner or host/owner/repo): NO filePath, entire string is resourceBase
   *   - 3+ slashes (host/owner/repo/path/to/file): split at 3rd slash
   *
   * Examples:
   *   "github.com/avfs-io/avfs-core/docs/README.md"
   *     → { resourceBase: "github.com/avfs-io/avfs-core", filePath: "docs/README.md" }
   *   "github.com/avfs-io/core/readme.md"
   *     → { resourceBase: "github.com/avfs-io/core", filePath: "readme.md" }
   *   "github.com/avfs-io/core"
   *     → { resourceBase: "github.com/avfs-io/core", filePath: null } (no file path)
   *   "github.com/avfs-io"
   *     → { resourceBase: "github.com/avfs-io", filePath: null } (incomplete)
   */
  splitAvfsPath(path: string): AvfsPathSplitResult {
    let slashCount = 0;
    let thirdSlashIdx = -1;

    for (let i = 0; i < path.length; i++) {
      if (path[i] === '/') {
        slashCount++;
        if (slashCount === 3) {
          thirdSlashIdx = i;
          break; // Found the boundary — no need to continue
        }
      }
    }

    // Fewer than 3 slashes: entire path is resourceBase (no filePath component)
    // This covers: "github.com" (0 slashes), "github.com/owner" (1), "github.com/owner/repo" (2)
    if (thirdSlashIdx < 0) {
      return { resourceBase: path, filePath: null };
    }

    // 3+ slashes: resourceBase = up to (but not including) 3rd slash
    // filePath = everything after 3rd slash
    const resourceBase = path.slice(0, thirdSlashIdx);
    const filePath = path.slice(thirdSlashIdx + 1);

    return { resourceBase, filePath };
  }
}
