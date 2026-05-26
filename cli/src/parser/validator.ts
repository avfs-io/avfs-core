import type { ValidationResult } from './types.js';
import { parseAvfsUri } from './uri-parser.js';

/**
 * Validate an AVFS address string.
 * Wraps parseAvfsUri() into a simplified result object.
 *
 * @param raw - Raw AVFS address string to validate
 * @returns ValidationResult with valid flag, parsed address (if valid), and errors (if invalid)
 */
export function validateAvfsUri(raw: string): ValidationResult {
  const parsed = parseAvfsUri(raw);

  if (parsed.isValid) {
    return {
      valid: true,
      address: parsed,
    };
  }

  return {
    valid: false,
    errors: parsed.errors,
  };
}
