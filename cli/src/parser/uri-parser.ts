import type { ParsedAddress } from './types.js';
import { SUPPORTED_PROTOCOLS } from './types.js';

/**
 * Parse an AVFS URI string into a structured ParsedAddress.
 * Follows the algorithm defined in PRD §3.3.1:
 *
 *   1. Prefix check ("avfs://")
 *   2. Anchor split ("#")
 *   3. Protocol extraction (first "/")
 *   4. resourceBase / version / filePath split
 *      - git protocol: support @version syntax
 *      - non-git protocols: simple base/path split
 *   5. Validation (collect errors, never throw)
 */
export function parseAvfsUri(raw: string): ParsedAddress {
  const errors: string[] = [];

  // Step 1 — prefix check
  if (!raw.startsWith('avfs://')) {
    return {
      protocol: '',
      resourceBase: '',
      version: null,
      filePath: null,
      anchor: null,
      rawInput: raw,
      isValid: false,
      errors: ["Address must start with 'avfs://'"],
    };
  }

  // Step 2 — body extraction
  let body = raw.slice('avfs://'.length);
  if (body.length === 0) {
    return {
      protocol: '',
      resourceBase: '',
      version: null,
      filePath: null,
      anchor: null,
      rawInput: raw,
      isValid: false,
      errors: ['Address is empty after prefix'],
    };
  }

  // Step 3 — anchor split
  let anchor: string | null = null;
  const hashIdx = body.indexOf('#');
  if (hashIdx >= 0) {
    anchor = body.slice(hashIdx + 1);
    body = body.slice(0, hashIdx);
  }

  // Step 4a — protocol extraction
  const slashIdx = body.indexOf('/');
  if (slashIdx < 0) {
    // Only protocol, no resource base or file path
    const protocol = body.toLowerCase();
    if (!(SUPPORTED_PROTOCOLS as readonly string[]).includes(protocol)) {
      return {
        protocol,
        resourceBase: '',
        version: null,
        filePath: null,
        anchor,
        rawInput: raw,
        isValid: false,
        errors: [`Unsupported protocol: '${protocol}'`],
      };
    }
    return {
      protocol,
      resourceBase: '',
      version: null,
      filePath: null,
      anchor,
      rawInput: raw,
      isValid: false,
      errors: ['File path is required'],
    };
  }

  const protocol = body.slice(0, slashIdx).toLowerCase();
  if (!(SUPPORTED_PROTOCOLS as readonly string[]).includes(protocol)) {
    return {
      protocol,
      resourceBase: '',
      version: null,
      filePath: null,
      anchor,
      rawInput: raw,
      isValid: false,
      errors: [`Unsupported protocol: '${protocol}'`],
    };
  }

  let remaining = body.slice(slashIdx + 1);

  // Step 5 — resourceBase / version / filePath split
  let version: string | null = null;
  let filePath: string | null = null;
  let resourceBase = '';

  if (protocol === 'git') {
    // Git protocol: support @version syntax
    const atIdx = remaining.indexOf('@');
    if (atIdx >= 0) {
      resourceBase = remaining.slice(0, atIdx);
      const afterAt = remaining.slice(atIdx + 1);
      const pathSlashIdx = afterAt.indexOf('/');
      if (pathSlashIdx >= 0) {
        version = afterAt.slice(0, pathSlashIdx);
        filePath = afterAt.slice(pathSlashIdx + 1);
      } else {
        version = afterAt;
        filePath = null;
      }
    } else {
      // No @version: remaining is resourceBase/filePath
      const baseSlashIdx = remaining.indexOf('/');
      if (baseSlashIdx >= 0) {
        resourceBase = remaining.slice(0, baseSlashIdx);
        filePath = remaining.slice(baseSlashIdx + 1);
      } else {
        resourceBase = remaining;
        filePath = null;
      }
    }
  } else {
    // Non-git protocols: no version concept, remaining is resourceBase/filePath
    const baseSlashIdx = remaining.indexOf('/');
    if (baseSlashIdx >= 0) {
      resourceBase = remaining.slice(0, baseSlashIdx);
      filePath = remaining.slice(baseSlashIdx + 1);
    } else {
      resourceBase = remaining;
      filePath = null;
    }
  }

  // Step 6 — validation
  if (!resourceBase) {
    errors.push('Missing resource base');
  }
  if (!filePath) {
    if (protocol === 'git' && version) {
      errors.push('File path is required when version is specified');
    } else {
      errors.push('File path is required');
    }
  }

  return {
    protocol,
    resourceBase,
    version,
    filePath,
    anchor,
    rawInput: raw,
    isValid: errors.length === 0,
    errors,
  };
}
