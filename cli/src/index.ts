const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
if (majorVersion < 20) {
  console.error(`avfs requires Node.js >= 20 (current: v${nodeVersion})`);
  process.exit(1);
}

import { Command } from 'commander';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; description: string };

const program = new Command();

program
  .name('avfs')
  .version(pkg.version, '-V, --version', 'output the version number')
  .description(pkg.description);

import { registerAllCommands } from './commands/index.js';
registerAllCommands(program);

program.parse(process.argv);
