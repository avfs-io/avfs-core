import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliEntry = resolve(
  fileURLToPath(import.meta.url),
  '../../dist/index.mjs',
);

/** Helper: run CLI command and return combined stdout+stderr, swallowing non-zero exits */
function runCli(args: string): string {
  try {
    return execSync(`node ${cliEntry} ${args}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    // execSync throws on non-zero exit — return captured output anyway
    return (err.stdout ?? '') + (err.stderr ?? '');
  }
}

describe('Mock commands', () => {
  it('fetch should output error for invalid address', () => {
    const output = runCli('fetch test');
    expect(output).toContain('Invalid AVFS address');
  });

  it('convert should output error for undetectable protocol', () => {
    const output = runCli('convert test');
    expect(output).toContain('Unable to detect protocol');
  });

  it('stat should output parsed result (even if invalid)', () => {
    const output = runCli('stat test');
    const json = JSON.parse(output);
    expect(json.isValid).toBe(false);
    expect(json.errors).toContain("Address must start with 'avfs://'");
  });

  it('validate should output validation result (even if invalid)', () => {
    const output = runCli('validate test');
    const json = JSON.parse(output);
    expect(json.valid).toBe(false);
    expect(json.errors).toContain("Address must start with 'avfs://'");
  });

  it('plugin list should output mock message', () => {
    const output = runCli('plugin list');
    expect(output).toContain('planned but not yet implemented');
  });

  it('credential set should output mock message', () => {
    const output = runCli('credential set key value');
    expect(output).toContain('planned but not yet implemented');
  });
});
