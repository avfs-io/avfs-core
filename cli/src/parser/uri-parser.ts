import type { ParsedAddress } from './types.js';
import { SUPPORTED_PROTOCOLS } from './types.js';
import { PlatformRegistry } from './git/platform-registry.js';

/** Singleton registry for platform-aware path splitting (avoids re-creation on each parse call) */
let _registry: PlatformRegistry | null = null;

function getRegistry(): PlatformRegistry {
  if (!_registry) {
    _registry = new PlatformRegistry();
  }
  return _registry;
}

/**
 * Parse an AVFS URI string into a structured ParsedAddress.
 *
 * ## Syntax (v2 — query-parameter version)
 *
 * ```
 * avfs://<proto>/<resource-base>[/<file-path>][?ref=<version>][#anchor]
 * ```
 *
 * Key design decision: version is passed via query parameter `?ref=`
 * rather than inline `@version` syntax. This eliminates ambiguity when
 * branch names contain "/" (e.g., `feat/login`).
 *
 * For git protocol, resourceBase is split from filePath using
 * platform-aware rules (see PlatformRegistry.splitAvfsPath):
 *   - GitHub:   github.com/{owner}/{repo} → fixed 2 segments after host
 *   - GitLab:   gitlab.com/{group}/{...}/{repo} → variable (future)
 *
 * ## Algorithm
 *
 * 1. Prefix check ("avfs://")
 * 2. Anchor split ("#") — anchor must be at end per RFC 3986
 * 3. Protocol extraction (first "/")
 * 4. Query string split ("?") — extract ref= version for git protocol
 * 5. resourceBase / filePath split using platform-aware rules
 * 6. Validation (collect errors, never throw)
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

  // Step 3 — anchor split (# must be after ? per RFC 3986)
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

  // Step 4b — query string extraction (?ref=version for git protocol)
  let version: string | null = null;
  const queryIdx = remaining.indexOf('?');
  if (queryIdx >= 0) {
    const queryString = remaining.slice(queryIdx + 1);
    remaining = remaining.slice(0, queryIdx);

    // Extract ref= parameter for git protocol
    if (protocol === 'git') {
      version = extractRefParam(queryString);
      if (version !== null && version.length === 0) {
        version = null; // treat empty ref as not specified
        errors.push('Version ref parameter must not be empty');
      }
    }
    // Non-git protocols: ignore query string (or could warn)
  }

  // Step 5 — resourceBase / filePath split
  let resourceBase = '';
  let filePath: string | null = null;

  if (protocol === 'git') {
    // Use platform-aware splitting (GitHub: host/owner/repo = resourceBase)
    const registry = getRegistry();
    const splitResult = registry.splitAvfsPath(remaining);
    resourceBase = splitResult.resourceBase;
    filePath = splitResult.filePath;
  } else {
    // Non-git protocols: simple first-slash split
    const baseSlashIdx = remaining.indexOf('/');
    if (baseSlashIdx >= 0) {
      resourceBase = remaining.slice(0, baseSlashIdx);
      filePath = remaining.slice(baseSlashIdx + 1);
    } else {
      resourceBase = remaining;
    }
  }

  // Step 6 — validation
  if (!resourceBase) {
    errors.push('Missing resource base');
  }
  if (!filePath) {
    errors.push('File path is required');
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

/**
 * Extract the `ref` parameter value from a query string.
 *
 * @param queryString - Query string portion after "?", e.g. "ref=main&token=abc"
 * @returns The ref value, or null if not present
 */
function extractRefParam(queryString: string): string | null {
  // Simple manual parsing to avoid URLSearchParams encoding side effects
  for (const pair of queryString.split('&')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) { // key must be non-empty
      const key = pair.slice(0, eqIdx).toLowerCase();
      if (key === 'ref') {
        return pair.slice(eqIdx + 1); // raw value (no decode needed for now)
      }
    }
  }
  return null;
}
