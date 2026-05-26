import type { ParsedAddress, NativeUrl, ProtocolType } from '../types.js';
import type { ProtocolConverter } from './converter.interface.js';

/** HTTP protocol converter — http:// URLs ↔ avfs://http/... */
export class HttpConverter implements ProtocolConverter {
  readonly protocol: ProtocolType = 'http';

  detect(nativeInput: string): boolean {
    return /^http:\/\//.test(nativeInput);
  }

  /**
   * Convert HTTP URL → AVFS URI.
   *
   * Examples:
   *   http://192.168.1.100:8080/api/data.csv → resourceBase="192.168.1.100:8080", filePath="api/data.csv"
   *   http://example.com/data.csv             → resourceBase="example.com",          filePath="data.csv"
   */
  toAvfs(nativeInput: string): ParsedAddress {
    const urlBody = nativeInput.slice('http://'.length);

    const slashIdx = urlBody.indexOf('/');
    const resourceBase = slashIdx >= 0 ? urlBody.slice(0, slashIdx) : urlBody;
    const filePath = slashIdx >= 0 ? urlBody.slice(slashIdx + 1) : null;

    const errors: string[] = [];
    if (!resourceBase) errors.push('Missing resource base');
    if (!filePath) errors.push('File path is required');

    return {
      protocol: 'http',
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
   * Convert AVFS URI → HTTP URL.
   *
   * Reconstructs the original http:// URL from resourceBase + filePath.
   *
   * Examples:
   *   avfs://http/192.168.1.100:8080/api/data.csv  → http://192.168.1.100:8080/api/data.csv
   *   avfs://http/example.com/data.csv             → http://example.com/data.csv
   */
  toNative(parsed: ParsedAddress): NativeUrl {
    const url = `http://${parsed.resourceBase}/${parsed.filePath}`;
    return { url, protocol: 'http' };
  }
}
