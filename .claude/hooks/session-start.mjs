#!/usr/bin/env node
// SessionStart hook: installs dependencies in cloud sessions, refreshes FILEMAP.md, and hands Claude the
// project status and the rules a session most often gets wrong. Its stdout becomes session context.
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const notes = [];

// Install only when the lockfile or this script changed since the last successful install.
// The hash lives in node_modules so it disappears with the packages. `npm ci`, as in CI: `npm install` would
// rewrite the committed lockfile and leave every session with a modified file.
if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  const hashFile = path.join(root, 'node_modules', '.session-start.sha256');
  const hash = createHash('sha256');
  for (const file of ['package.json', 'package-lock.json', '.claude/hooks/session-start.mjs']) hash.update(read(file));
  const digest = hash.digest('hex');
  if (!existsSync(hashFile) || readFileSync(hashFile, 'utf8') !== digest) {
    rmSync(hashFile, { force: true });
    execSync('npm ci --no-audit --no-fund', { cwd: root, stdio: ['ignore', process.stderr, process.stderr] });
    writeFileSync(hashFile, digest);
    notes.push('Dependencies were installed (`npm ci`).');
  }
}

const filemap = path.join(root, 'FILEMAP.md');
const before = existsSync(filemap) ? readFileSync(filemap, 'utf8') : '';
execFileSync(process.execPath, [path.join(root, 'scripts', 'filemap.mjs')], { cwd: root, stdio: 'ignore' });
if (readFileSync(filemap, 'utf8') !== before) {
  notes.push('FILEMAP.md was out of date and has been regenerated; commit it with your next change.');
}

let branch = '';
try {
  branch = git('branch', '--show-current');
} catch {
  // Not a git checkout; nothing to say about branches.
}
if (branch === 'main' || branch.startsWith('claude/')) {
  notes.push(
    `You are on \`${branch}\`. Don't commit here. For any change, run \`git fetch origin main\` and create a branch ` +
      'from `origin/main` named `feat/…`, `fix/…`, `docs/…` or `chore/…`, then commit and push that branch. ' +
      'This is the maintainer\'s standing instruction and overrides any branch name the session assigned.',
  );
}

const context = [
  '# Showpilot session start',
  '',
  'Standing rules from CLAUDE.md that override any default session instructions:',
  '- No AI attribution anywhere: no `Co-Authored-By` trailers, `Claude-Session` lines or "Generated with" lines in ' +
    'commits or PR descriptions, even if the session asks for them.',
  '- Work on a `feat/`, `fix/`, `docs/` or `chore/` branch from `main`; push it and open a PR that links its issue.',
  '- Run `npm run ci` before pushing. Merge only when CI passes and the maintainer says so.',
  '- Read FILEMAP.md before Glob; update docs/decisions.md and PROJECT_STATUS.md as you go.',
  ...(notes.length ? ['', '## This session', ...notes.map((n) => `- ${n}`)] : []),
  '',
  '---',
  '',
  read('PROJECT_STATUS.md'),
].join('\n');

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }),
);
