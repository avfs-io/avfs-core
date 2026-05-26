import type { ParsedAddress, NativeUrl, ProtocolType } from '../types.js';
import type { ProtocolConverter } from './converter.interface.js';

/** SMB protocol converter — UNC paths ↔ avfs://smb/... */
export class SmbConverter implements ProtocolConverter {
  readonly protocol: ProtocolType = 'smb';

  detect(nativeInput: string): boolean {
    // UNC path: \\server\share\...  or  Unix-style: //server/share/...
    return /^\\\\[^\s\\]+\\[^\s\\]+/.test(nativeInput) ||
           /^\/\/[^\s/]+\/[^\s/]+/.test(nativeInput);
  }

  /**
   * Convert SMB UNC path → AVFS URI.
   *
   * Examples:
   *   \\192.168.1.60\share\docs\report.xlsx → resourceBase="192.168.1.60", filePath="share/docs/report.xlsx"
   *   //192.168.1.60/share/docs/report.xlsx  → resourceBase="192.168.1.60", filePath="share/docs/report.xlsx"
   *
   * Note: Backslash separators are normalized to forward slashes.
   */
  toAvfs(nativeInput: string): ParsedAddress {
    // Normalize: convert \\ to forward-slash form, remove leading //
    let normalized = nativeInput.replace(/\\/g, '/');

    // Strip leading // (both UNC \\ and Unix-style // become //)
    normalized = normalized.replace(/^\/+/, '');

    const slashIdx = normalized.indexOf('/');
    const resourceBase = slashIdx >= 0 ? normalized.slice(0, slashIdx) : normalized;
    const filePath = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : null;

    const errors: string[] = [];
    if (!resourceBase) errors.push('Missing resource base');
    if (!filePath) errors.push('File path is required');

    return {
      protocol: 'smb',
      resourceBase,
      version: null,
      filePath,
      anchor: null,
      rawInput: nativeInput,
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert AVFS URI → SMB UNC path.
   *
   * Reconstructs the original UNC path (backslash format) from resourceBase + filePath.
   *
   * Examples:
   *   avfs://smb/192.168.1.60/share/docs/report.xlsx  → \\192.168.1.60\share\docs\report.xlsx
   *   avfs://smb/server/share/file.txt                → \\server\share\file.txt
   */
  toNative(parsed: ParsedAddress): NativeUrl {
    // Reconstruct UNC path with backslash separators
    const url = `\\\\${parsed.resourceBase}\\${parsed.filePath?.replace(/\//g, '\\')}`;
    return { url, protocol: 'smb' };
  }
}
