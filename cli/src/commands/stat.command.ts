import type { Command } from 'commander';
import { parseAvfsUri } from '../parser/uri-parser.js';

export function registerStatCommand(program: Command): void {
  program
    .command('stat')
    .description('Get file metadata from an AVFS address')
    .argument('<address>', 'AVFS address to inspect')
    .action((address: string) => {
      const parsed = parseAvfsUri(address);
      console.log(JSON.stringify(parsed));

      if (!parsed.isValid) {
        process.exitCode = 1;
      }
    });
}
