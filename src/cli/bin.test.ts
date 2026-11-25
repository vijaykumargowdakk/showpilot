import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// npm runs the installed `showpilot` command through this line, so on macOS and Linux a CRLF after it (`node\r`)
// breaks the command, though `node bin/showpilot.mjs`, as CI runs it, still works.
describe('the CLI entry point', () => {
  it('starts with a node shebang ending in LF', () => {
    const bin = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'showpilot.mjs'));
    expect(bin.subarray(0, 20).toString('latin1')).toBe('#!/usr/bin/env node\n');
  });
});
