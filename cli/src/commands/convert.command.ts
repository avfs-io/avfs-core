import type { Command } from 'commander';
import type { ParsedAddress, ProtocolType } from '../parser/types.js';
import { parseAvfsUri } from '../parser/uri-parser.js';
import { detectProtocol, getConverter } from '../parser/protocol-converters/converter.interface.js';
import { FileConverter } from '../parser/protocol-converters/file-converter.js';
import { HttpConverter } from '../parser/protocol-converters/http-converter.js';
import { HttpsConverter } from '../parser/protocol-converters/https-converter.js';
import { SmbConverter } from '../parser/protocol-converters/smb-converter.js';
import { registerConverter } from '../parser/protocol-converters/converter.interface.js';

// Register all non-git converters (git converter is lazy-initialized)
registerConverter(new FileConverter());
registerConverter(new HttpConverter());
registerConverter(new HttpsConverter());
registerConverter(new SmbConverter());

/**
 * Build an AVFS URI string from a ParsedAddress result.
 */
function buildAvfsUri(result: ParsedAddress): string {
  let uri = `avfs://${result.protocol}/${result.resourceBase}`;
  if (result.version) {
    uri += `@${result.version}`;
  }
  if (result.filePath) {
    uri += `/${result.filePath}`;
  }
  return uri;
}

export function registerConvertCommand(program: Command): void {
  program
    .command('convert')
    .description('Convert between AVFS address and native path/URL')
    .argument('<path>', 'Path or AVFS address to convert')
    .option('--to-avfs', 'Convert native path/URL to AVFS format')
    .option('--to-native', 'Convert AVFS format to native path/URL')
    .action((path: string, options: { toAvfs?: boolean; toNative?: boolean }) => {
      // Validate: --to-avfs and --to-native are mutually exclusive
      if (options.toAvfs && options.toNative) {
        console.error('Error: --to-avfs and --to-native cannot be specified simultaneously');
        process.exit(1);
      }

      // Default direction: auto-detect based on input format
      if (!options.toAvfs && !options.toNative) {
        // If input starts with avfs://, default to --to-native
        if (path.startsWith('avfs://')) {
          options.toNative = true;
        } else {
          options.toAvfs = true;
        }
      }

      // ── --to-avfs path ──
      if (options.toAvfs) {
        const protocol = detectProtocol(path);
        if (!protocol) {
          console.error(`Error: Unable to detect protocol for: ${path}`);
          process.exit(1);
        }

        const converter = getConverter(protocol);
        if (!converter) {
          console.error(`Error: No converter registered for protocol: ${protocol}`);
          process.exit(1);
        }

        const result = converter.toAvfs(path);
        if (!result.isValid) {
          console.error(`Error: ${result.errors.join(', ')}`);
          process.exit(1);
        }

        const avfsUri = buildAvfsUri(result);
        console.log(avfsUri);
        return;
      }

      // ─--to-native path ──
      if (options.toNative) {
        // Parse as AVFS URI first
        const parsed = parseAvfsUri(path);
        if (!parsed.isValid) {
          console.error(`Error: Invalid AVFS URI: ${parsed.errors.join(', ')}`);
          process.exit(1);
        }

        const converter = getConverter(parsed.protocol as ProtocolType);
        if (!converter) {
          console.error(`Error: No converter registered for protocol: ${parsed.protocol}`);
          process.exit(1);
        }

        const nativeResult = converter.toNative(parsed);

        // Git protocol outputs JSON (contains metadata)
        if (parsed.protocol === 'git') {
          console.log(JSON.stringify(nativeResult.metadata ?? { url: nativeResult.url }, null, 2));
        } else {
          // Other protocols output plain text
          console.log(nativeResult.url);
        }
        return;
      }
    });
}
