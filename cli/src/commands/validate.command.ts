import type { Command } from 'commander';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate an AVFS address syntax')
    .argument('<address>', 'AVFS address to validate')
    .action(() => {
      console.log(
        '⚠️  avfs validate is planned but not yet implemented. See avfs help for available commands.'
      );
    });
}
