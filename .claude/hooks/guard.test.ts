import { describe, expect, it } from 'vitest';
import { check } from './guard.mjs';

const bash = (command: string, branch = 'feat/x') => check({ tool_name: 'Bash', tool_input: { command } }, () => branch);
const gh = (tool: string, toolInput: object) => check({ tool_name: `mcp__github__${tool}`, tool_input: toolInput }, () => '');

describe('guard: commits', () => {
  it('allows a plain commit on a feature branch', () => {
    expect(bash('git commit -m "Fix the cursor"')).toBeNull();
  });

  it('blocks AI attribution in a commit message', () => {
    expect(bash('git commit -m "Fix\n\nCo-Authored-By: Bot <x@y>"')?.decision).toBe('deny');
    expect(bash('git commit -m "Fix\n\nClaude-Session: https://example.com"')?.decision).toBe('deny');
  });

  it('blocks commits on main and on session-assigned claude/ branches', () => {
    expect(bash('git commit -m "x"', 'main')?.decision).toBe('deny');
    expect(bash('git add . && git commit -m "x"', 'claude/new-session-abc')?.decision).toBe('deny');
  });

  it('allows a commit when the same command creates a branch first', () => {
    expect(bash('git switch -c fix/y origin/main && git commit -m "x"', 'main')).toBeNull();
  });

  it('ignores commands that only mention commit', () => {
    expect(bash('git log --format=%B -1 | grep -i co-authored-by:', 'main')).toBeNull();
  });
});

describe('guard: pushes', () => {
  it('allows pushing a feature branch', () => {
    expect(bash('git push -u origin feat/x')).toBeNull();
    expect(bash('git push')).toBeNull();
  });

  it('blocks pushes to main, explicit or via the current branch', () => {
    expect(bash('git push origin main')?.decision).toBe('deny');
    expect(bash('git push origin HEAD:main')?.decision).toBe('deny');
    expect(bash('git push -u origin HEAD', 'main')?.decision).toBe('deny');
    expect(bash('git push', 'main')?.decision).toBe('deny');
  });

  it('blocks pushes to claude/ branches', () => {
    expect(bash('git push -u origin claude/new-session-abc')?.decision).toBe('deny');
    expect(bash('git push', 'claude/new-session-abc')?.decision).toBe('deny');
  });

  it('allows deleting a remote branch', () => {
    expect(bash('git push origin --delete claude/new-session-abc')).toBeNull();
  });
});

describe('guard: merges', () => {
  it('blocks a local merge into main but not merge-base or merges elsewhere', () => {
    expect(bash('git merge feat/x', 'main')?.decision).toBe('deny');
    expect(bash('git merge-base HEAD origin/main', 'main')).toBeNull();
    expect(bash('git merge origin/main', 'feat/x')).toBeNull();
  });

  it('asks before merging a pull request', () => {
    expect(gh('merge_pull_request', { pullNumber: 1 })?.decision).toBe('ask');
  });
});

describe('guard: GitHub writes', () => {
  it('blocks writing files straight to main or a claude/ branch', () => {
    expect(gh('push_files', { branch: 'main', message: 'x' })?.decision).toBe('deny');
    expect(gh('create_or_update_file', { branch: 'claude/abc', message: 'x' })?.decision).toBe('deny');
    expect(gh('push_files', { branch: 'docs/x', message: 'x' })).toBeNull();
  });

  it('blocks AI attribution in PR descriptions', () => {
    expect(gh('create_pull_request', { title: 'x', body: '🤖 Generated with [Claude Code](https://claude.com)' })?.decision).toBe('deny');
    expect(gh('update_pull_request', { body: 'Closes #9' })).toBeNull();
  });

  it('leaves other tools alone', () => {
    expect(check({ tool_name: 'Read', tool_input: {} }, () => 'main')).toBeNull();
  });
});
