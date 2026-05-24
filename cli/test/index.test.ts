import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = resolve(
  fileURLToPath(import.meta.url),
  '../../dist/index.mjs',
);

describe('CLI entry', () => {
  it('should output version 0.1.0 with --version', () => {
    const output = execSync(`node ${cliEntry} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toBe('0.1.0');
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
