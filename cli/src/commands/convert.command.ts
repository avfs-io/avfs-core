import type { Command } from 'commander';

export function registerConvertCommand(program: Command): void {
  program
    .command('convert')
    .description('Convert between AVFS address and native path/URL')
    .argument('<path>', 'Path or AVFS address to convert')
    .action(() => {
      console.log(
        '⚠️  avfs convert is planned but not yet implemented. See avfs help for available commands.'
      );
    });
}
