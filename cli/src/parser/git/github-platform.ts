import type { GitPlatform } from './git-platform.interface.js';

/**
 * GitHub platform implementation.
 *
 * Supports two native URL formats:
 * - HTTPS clone:  https://github.com/{owner}/{repo}[.git][/subpath]
 * - SSH clone:    git@github.com:{owner}/{repo}[.git][/subpath]
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
}
