import type { Command } from 'commander';

export function registerPluginCommand(program: Command): void {
  const pluginCmd = program
    .command('plugin')
    .description('Manage AVFS protocol plugins');

  pluginCmd
    .command('list')
    .description('List registered plugins')
    .action(() => {
      console.log(
        '⚠️  avfs plugin is planned but not yet implemented. See avfs help for available commands.'
      );
    });

  pluginCmd
    .command('load')
    .description('Load and register a plugin')
    .argument('<path>', 'Path to the plugin module')
    .action(() => {
      console.log(
        '⚠️  avfs plugin is planned but not yet implemented. See avfs help for available commands.'
      );
    });

  pluginCmd
    .command('unregister')
    .description('Unregister a plugin')
    .argument('<protocol>', 'Protocol identifier to unregister')
    .action(() => {
      console.log(
        '⚠️  avfs plugin is planned but not yet implemented. See avfs help for available commands.'
      );
    });
}
