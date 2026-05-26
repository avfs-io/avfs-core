import type { ParsedAddress, NativeUrl, ProtocolType } from '../types.js';
import type { ProtocolConverter } from './converter.interface.js';

/** File protocol converter — local filesystem paths ↔ avfs://file/... */
export class FileConverter implements ProtocolConverter {
  readonly protocol: ProtocolType = 'file';

  detect(nativeInput: string): boolean {
    return /^[~/]/.test(nativeInput) || /^[A-Za-z]:\\/.test(nativeInput);
  }

  /**
   * Convert local file path → AVFS URI.
   *
   * Examples:
   *   /home/user/file.txt      → resourceBase="home",  filePath="user/file.txt"
   *   C:\Users\file.txt        → resourceBase="C:",    filePath="Users/file.txt"
   *   ~/config.json            → resourceBase="~",     filePath="config.json"
   */
  toAvfs(nativeInput: string): ParsedAddress {
    let normalized = nativeInput;

    // Handle Windows absolute path (C:\... → C:/...)
    if (/^[A-Za-z]:\\/.test(normalized)) {
      normalized = normalized.replace(/\\/g, '/');
    }

    // Strip leading / for parsing
    const pathBody = normalized.startsWith('/') ? normalized.slice(1) : normalized;

    const slashIdx = pathBody.indexOf('/');
    const resourceBase = slashIdx >= 0 ? pathBody.slice(0, slashIdx) : pathBody;
    const filePath = slashIdx >= 0 ? pathBody.slice(slashIdx + 1) : null;

    const errors: string[] = [];
    if (!resourceBase) errors.push('Missing resource base');
    if (!filePath) errors.push('File path is required');

    return {
      protocol: 'file',
      resourceBase,
      version: null,
      filePath,
      anchor: null,
      rawInput: nativeInput,
      isValid: errors.length === 0,
      errors,
    };
  }

  /** Not yet implemented — will be done in task 2.3 */
  toNative(_parsed: ParsedAddress): NativeUrl {
    throw new Error('file-converter.toNative() not yet implemented');
  }
}
