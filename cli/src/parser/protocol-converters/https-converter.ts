import type { ParsedAddress, NativeUrl, ProtocolType } from '../types.js';
import type { ProtocolConverter } from './converter.interface.js';

/** HTTPS protocol converter — https:// URLs ↔ avfs://https/... */
export class HttpsConverter implements ProtocolConverter {
  readonly protocol: ProtocolType = 'https';

  detect(nativeInput: string): boolean {
    return /^https:\/\//.test(nativeInput);
  }

  /**
   * Convert HTTPS URL → AVFS URI.
   *
   * Examples:
   *   https://cdn.example.com/files/v1/package.zip → resourceBase="cdn.example.com", filePath="files/v1/package.zip"
   *   https://example.com/data.csv                  → resourceBase="example.com",      filePath="data.csv"
   */
  toAvfs(nativeInput: string): ParsedAddress {
    const urlBody = nativeInput.slice('https://'.length);

    const slashIdx = urlBody.indexOf('/');
    const resourceBase = slashIdx >= 0 ? urlBody.slice(0, slashIdx) : urlBody;
    const filePath = slashIdx >= 0 ? urlBody.slice(slashIdx + 1) : null;

    const errors: string[] = [];
    if (!resourceBase) errors.push('Missing resource base');
    if (!filePath) errors.push('File path is required');

    return {
      protocol: 'https',
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
   * Convert AVFS URI → HTTPS URL.
   *
   * Reconstructs the original https:// URL from resourceBase + filePath.
   *
   * Examples:
   *   avfs://https/cdn.example.com/files/v1/package.zip  → https://cdn.example.com/files/v1/package.zip
   *   avfs://https/example.com/index.html                 → https://example.com/index.html
   */
  toNative(parsed: ParsedAddress): NativeUrl {
    const url = `https://${parsed.resourceBase}/${parsed.filePath}`;
    return { url, protocol: 'https' };
  }
}
