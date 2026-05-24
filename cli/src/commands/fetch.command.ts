import type { Command } from 'commander';

export function registerFetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('Fetch a file from an AVFS address')
    .argument('<address>', 'AVFS address to fetch')
    .action(() => {
      console.log(
        '⚠️  avfs fetch is planned but not yet implemented. See avfs help for available commands.'
      );
    });
}
