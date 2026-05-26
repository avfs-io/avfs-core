// Public API for the AVFS address parser module.

export { parseAvfsUri } from './uri-parser.js';
export { validateAvfsUri } from './validator.js';
export type {
  ParsedAddress,
  NativeUrl,
  ConvertOptions,
  ConvertResult,
  ValidationResult,
  ProtocolType,
  GitPlatformType,
} from './types.js';
export { SUPPORTED_PROTOCOLS, SUPPORTED_GIT_PLATFORMS } from './types.js';
