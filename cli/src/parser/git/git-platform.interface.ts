import type { GitPlatformType } from '../types.js';

/**
 * Git platform strategy interface.
 * Each platform (GitHub, GitLab, etc.) implements its own
 * URL detection and resourceBase extraction rules.
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
}
