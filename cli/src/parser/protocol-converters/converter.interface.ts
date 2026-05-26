import type { ParsedAddress, NativeUrl, ProtocolType } from '../types.js';
import { SUPPORTED_PROTOCOLS } from '../types.js';

/**
 * Protocol converter interface — each protocol implements
 * detect() / toAvfs() / toNative() for bidirectional conversion.
 */
export interface ProtocolConverter {
  /** Protocol type this converter handles */
  readonly protocol: ProtocolType;

  /** Detect if nativeInput belongs to this protocol */
  detect(nativeInput: string): boolean;

  /** Convert native format → ParsedAddress (AVFS format) */
  toAvfs(nativeInput: string): ParsedAddress;

  /** Convert ParsedAddress (AVFS format) → native format */
  toNative(parsed: ParsedAddress): NativeUrl;
}

// ── Converter Registry (internal) ──

const converterMap = new Map<ProtocolType, ProtocolConverter>();

/**
 * Register a protocol converter.
 * Overwrites any existing converter for the same protocol.
 */
export function registerConverter(converter: ProtocolConverter): void {
  converterMap.set(converter.protocol, converter);
}

/**
 * Get a converter by protocol type.
 * Returns undefined if not registered.
 */
export function getConverter(protocol: ProtocolType): ProtocolConverter | undefined {
  if (converterMap.has(protocol)) {
    return converterMap.get(protocol);
  }
  // Lazy-init GitConverter (deferred require avoids circular deps)
  if (protocol === 'git') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GitConverter } = require('./git-converter.js');
    const gitConverter = new GitConverter();
    converterMap.set('git', gitConverter);
    return gitConverter;
  }
  return undefined;
}

// ── Protocol Detection ──

/**
 * Detect protocol from a native input string.
 *
 * Detection priority (highest first):
 *   1. Git SSH URL       → /^git@github\.com:.+/
 *   2. Git HTTPS URL     → GitHub repo pattern
 *   3. SMB UNC path      → \\\\server\\share...
 *   4. File path         → /absolute/path or ~/path
 *   5. HTTPS URL         → https://...
 *   6. HTTP URL          → http://...
 *
 * Returns the detected ProtocolType or null if unrecognized.
 */
export function detectProtocol(nativeInput: string): ProtocolType | null {
  // 1. Git SSH URL (highest priority — only match known patterns)
  if (/^git@[a-zA-Z0-9.-]+:[^/]+\/[^/]+/.test(nativeInput)) {
    return 'git';
  }

  // 2. Git HTTPS URL (github.com/org/repo pattern)
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(nativeInput)) {
    return 'git';
  }

  // 3. SMB UNC path (\\\\server\\share or //server/share)
  if (/^\\\\[^\s\\]+\\[^\s\\]+/.test(nativeInput) ||
      /^\/\/[^\s/]+\/[^\s/]+/.test(nativeInput)) {
    return 'smb';
  }

  // 4. File path (Unix absolute /, home ~, or Windows C:\)
  if (/^[~/]/.test(nativeInput) || /^[A-Za-z]:\\/.test(nativeInput)) {
    return 'file';
  }

  // 5. HTTPS URL
  if (/^https:\/\//.test(nativeInput)) {
    return 'https';
  }

  // 6. HTTP URL
  if (/^http:\/\//.test(nativeInput)) {
    return 'http';
  }

  return null;
}

/**
 * Check if protocol is in the supported list.
 */
export function isSupportedProtocol(proto: string): proto is ProtocolType {
  return (SUPPORTED_PROTOCOLS as readonly string[]).includes(proto);
}
