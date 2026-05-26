import type { Command } from 'commander';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseAvfsUri } from '../parser/uri-parser.js';
import { GitDriver } from '../drivers/git.driver.js';

/**
 * Register the `avfs fetch` command.
 *
 * Fetches file content from a Git AVFS address via the GitHub REST API.
 * Supports streaming output to stdout (default) or to a file (`-o` option).
 * Only the `git` protocol is currently supported.
 */
export function registerFetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('Fetch a file from an AVFS address (git protocol only)')
    .argument('<address>', 'AVFS address to fetch')
    .option('-o, --output <file>', 'Write output to a file instead of stdout')
    .action(async (address: string, options: { output?: string }) => {
      try {
        // 1. Parse AVFS URI
        const parsed = parseAvfsUri(address);

        if (!parsed.isValid) {
          console.error(`Invalid AVFS address: ${parsed.errors.join(', ')}`);
          process.exitCode = 1;
          return;
        }

        // 2. Protocol check — only git is supported
        if (parsed.protocol !== 'git') {
          console.error(
            `Error: fetch for protocol "${parsed.protocol}" is not yet implemented. Only "git" protocol is supported.`,
          );
          process.exitCode = 1;
          return;
        }

        // 3. Validate required fields
        if (!parsed.filePath) {
          console.error('Error: AVFS address must include a file path.');
          process.exitCode = 1;
          return;
        }

        // 4. Connect and read via GitHub API
        const driver = new GitDriver();
        const connectOptions = parsed.version
          ? { credentials: { version: parsed.version } }
          : undefined;
        await driver.connect(parsed.resourceBase, connectOptions);

        const stream = await driver.read(parsed.filePath);

        // 5. Stream output — convert Web ReadableStream to Node.js Readable
        const nodeReadable = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
        const destination = options.output ? createWriteStream(options.output) : process.stdout;

        await pipeline(nodeReadable, destination);

        // Ensure newline after content when writing to stdout (TTY)
        if (!options.output && process.stdout.isTTY) {
          console.log();
        }

        await driver.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
