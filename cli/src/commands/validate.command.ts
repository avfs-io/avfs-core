import type { Command } from 'commander';
import { validateAvfsUri } from '../parser/validator.js';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate an AVFS address syntax')
    .argument('<address>', 'AVFS address to validate')
    .action((address: string) => {
      const result = validateAvfsUri(address);
      console.log(JSON.stringify(result));

      if (!result.valid) {
        process.exitCode = 1;
      }
    });
}
