#!/usr/bin/env node
// PostToolUse hook: records each edited file in .claude/.pending-review for the end-of-turn review.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    return;
  }

  const filePath = input.tool_input?.file_path ?? input.tool_response?.filePath;
  if (!filePath) return;

  const rel = path.relative(root, path.resolve(root, filePath));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;

  const pendingFile = path.join(root, '.claude', '.pending-review');
  mkdirSync(path.dirname(pendingFile), { recursive: true });
  const existing = existsSync(pendingFile) ? readFileSync(pendingFile, 'utf8') : '';
  const lines = new Set(existing.split('\n').filter(Boolean));
  lines.add(rel.split(path.sep).join('/'));
  writeFileSync(pendingFile, [...lines].join('\n') + '\n');
});
