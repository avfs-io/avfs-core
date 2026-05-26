import type { Command } from 'commander';
import type { ParsedAddress } from '../parser/types.js';
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
    .option('--to-native', 'Convert AVFS format to native path/URL (not yet implemented)')
    .action((path: string, options: { toAvfs?: boolean; toNative?: boolean }) => {
      // Validate: --to-avfs and --to-native are mutually exclusive
      if (options.toAvfs && options.toNative) {
        console.error('Error: --to-avfs and --to-native cannot be specified simultaneously');
        process.exit(1);
      }

      // --to-native not implemented yet
      if (options.toNative) {
        console.log('--to-native is not yet implemented');
        return;
      }

      // Default to --to-avfs if no flag specified (auto-detect)
      if (!options.toAvfs) {
        options.toAvfs = true;
      }

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
      }
    });
}
