// === parser/types.ts ===
// Core type definitions for AVFS URI parsing, conversion, and validation.

/** Supported protocol types */
export const SUPPORTED_PROTOCOLS = ['file', 'http', 'https', 'smb', 'git'] as const;
export type ProtocolType = (typeof SUPPORTED_PROTOCOLS)[number];

/** Git platform identifiers */
export const SUPPORTED_GIT_PLATFORMS = ['github'] as const;
export type GitPlatformType = (typeof SUPPORTED_GIT_PLATFORMS)[number] | 'unknown';

/** AVFS URI parse result */
export interface ParsedAddress {
  /** Protocol type */
  protocol: ProtocolType | string;
  /** Resource base (e.g. github.com/avfs-io/core, /home/user) */
  resourceBase: string;
  /** Version/branch/tag (git protocol only, null for others) */
  version: string | null;
  /** File relative path */
  filePath: string | null;
  /** Anchor fragment (after #, optional) */
  anchor: string | null;
  /** Raw input address */
  rawInput: string;
  /** Whether validation passed */
  isValid: boolean;
  /** Validation error list (non-empty when isValid=false) */
  errors: string[];
}

/** Native address format (for convert --to-native output) */
export interface NativeUrl {
  /** Native URL or path */
  url: string;
  /** Protocol type */
  protocol: ProtocolType;
  /** Metadata (only for git protocol output) */
  metadata?: Record<string, string | null>;
}

/** Conversion options */
export interface ConvertOptions {
  /** Conversion direction */
  direction: 'to-avfs' | 'to-native';
  /** Explicit protocol (for disambiguation, e.g. bare references) */
  protocol?: ProtocolType;
}

/** Conversion result */
export interface ConvertResult {
  /** Input value */
  input: string;
  /** Output value */
  output: string;
  /** Conversion direction */
  direction: ConvertOptions['direction'];
  /** Protocol type */
  protocol: ProtocolType;
  /** Whether output is JSON (git to-native scenario) */
  isJson: boolean;
}

/** Validation result */
export interface ValidationResult {
  /** Whether the address is valid */
  valid: boolean;
  /** Parsed address (meaningful only when valid=true) */
  address?: ParsedAddress;
  /** Error messages (meaningful only when valid=false) */
  errors?: string[];
}
