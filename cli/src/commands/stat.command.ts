import type { Command } from 'commander';
import { parseAvfsUri } from '../parser/uri-parser.js';

export function registerStatCommand(program: Command): void {
  program
    .command('stat')
    .description('Get file metadata from an AVFS address')
    .argument('<address>', 'AVFS address to inspect')
    .action((address: string) => {
      try {
        const parsed = parseAvfsUri(address);
        console.log(JSON.stringify(parsed));

        if (!parsed.isValid) {
          process.exitCode = 1;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
