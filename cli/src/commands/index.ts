import type { Command } from 'commander';
import { registerFetchCommand } from './fetch.command.js';
import { registerConvertCommand } from './convert.command.js';
import { registerStatCommand } from './stat.command.js';
import { registerValidateCommand } from './validate.command.js';
import { registerPluginCommand } from './plugin.command.js';
import { registerCredentialCommand } from './credential.command.js';

export function registerAllCommands(program: Command): void {
  registerFetchCommand(program);
  registerConvertCommand(program);
  registerStatCommand(program);
  registerValidateCommand(program);
  registerPluginCommand(program);
  registerCredentialCommand(program);
}
