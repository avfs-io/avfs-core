import type { Command } from 'commander';
import { validateAvfsUri } from '../parser/validator.js';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate an AVFS address syntax')
    .argument('<address>', 'AVFS address to validate')
    .action((address: string) => {
      try {
        const result = validateAvfsUri(address);
        console.log(JSON.stringify(result));

        if (!result.valid) {
          process.exitCode = 1;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
