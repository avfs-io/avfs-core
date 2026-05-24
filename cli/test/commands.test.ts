import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = resolve(
  fileURLToPath(import.meta.url),
  '../../dist/index.mjs',
);

const mockMsg = 'planned but not yet implemented';

describe('Mock commands', () => {
  it('fetch should output mock message', () => {
    const output = execSync(`node ${cliEntry} fetch test`, {
      encoding: 'utf-8',
    });
    expect(output).toContain(mockMsg);
  });

  it('convert should output mock message', () => {
    const output = execSync(`node ${cliEntry} convert test`, {
      encoding: 'utf-8',
    });
    expect(output).toContain(mockMsg);
  });

  it('stat should output mock message', () => {
    const output = execSync(`node ${cliEntry} stat test`, {
      encoding: 'utf-8',
    });
    expect(output).toContain(mockMsg);
  });

  it('validate should output mock message', () => {
    const output = execSync(`node ${cliEntry} validate test`, {
      encoding: 'utf-8',
    });
    expect(output).toContain(mockMsg);
  });

  it('plugin list should output mock message', () => {
    const output = execSync(`node ${cliEntry} plugin list`, {
      encoding: 'utf-8',
    });
    expect(output).toContain(mockMsg);
  });

  it('credential set should output mock message', () => {
    const output = execSync(`node ${cliEntry} credential set key value`, {
      encoding: 'utf-8',
    });
    expect(output).toContain(mockMsg);
  });
});
