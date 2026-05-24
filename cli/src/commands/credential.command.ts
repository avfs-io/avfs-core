import type { Command } from 'commander';

export function registerCredentialCommand(program: Command): void {
  const credentialCmd = program
    .command('credential')
    .description('Manage AVFS credentials');

  credentialCmd
    .command('set')
    .description('Set a credential for a resource')
    .argument('<key>', 'Credential key')
    .argument('<value>', 'Credential value')
    .action(() => {
      console.log(
        '⚠️  avfs credential is planned but not yet implemented. See avfs help for available commands.'
      );
    });

  credentialCmd
    .command('list')
    .description('List all stored credentials')
    .action(() => {
      console.log(
        '⚠️  avfs credential is planned but not yet implemented. See avfs help for available commands.'
      );
    });

  credentialCmd
    .command('revoke')
    .description('Revoke a stored credential')
    .argument('<key>', 'Credential key to revoke')
    .action(() => {
      console.log(
        '⚠️  avfs credential is planned but not yet implemented. See avfs help for available commands.'
      );
    });

  credentialCmd
    .command('load')
    .description('Load credentials from a file')
    .argument('<path>', 'Path to the credential file')
    .action(() => {
      console.log(
        '⚠️  avfs credential is planned but not yet implemented. See avfs help for available commands.'
      );
    });
}
