import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const cliEntry = resolve(
  fileURLToPath(import.meta.url),
  '../../dist/index.mjs',
);

const pkg = JSON.parse(
  readFileSync(resolve(fileURLToPath(import.meta.url), '../../package.json'), 'utf-8'),
);

describe('CLI entry', () => {
  it(`should output version ${pkg.version} with --version`, () => {
    const output = execSync(`node ${cliEntry} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toBe(pkg.version);
  });

  it('should output help with --help', () => {
    const output = execSync(`node ${cliEntry} --help`, { encoding: 'utf-8' });
    expect(output).toContain('Usage: avfs');
    expect(output).toContain('Commands:');
    expect(output).toContain('Options:');
    expect(output).toContain('--version');
    expect(output).toContain('--help');
  });
});
