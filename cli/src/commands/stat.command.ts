import type { Command } from 'commander';

export function registerStatCommand(program: Command): void {
  program
    .command('stat')
    .description('Get file metadata from an AVFS address')
    .argument('<address>', 'AVFS address to inspect')
    .action(() => {
      console.log(
        '⚠️  avfs stat is planned but not yet implemented. See avfs help for available commands.'
      );
    });
}
