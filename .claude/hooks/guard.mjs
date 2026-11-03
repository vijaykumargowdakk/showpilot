// PreToolUse hook: enforces the git rules in CLAUDE.md for shell commands and GitHub tool calls.
// Fails open: if the input can't be read, the call goes ahead.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ATTRIBUTION = /co-authored-by:|claude-session:|generated with \[?claude/i;
const PREFIXES = '`feat/…`, `fix/…`, `docs/…` or `chore/…`';

const isProtected = (branch) => branch === 'main' || branch === 'master' || branch.startsWith('claude/');
const git = (sub) => new RegExp(`\\bgit\\s+(?:-C\\s+\\S+\\s+)*${sub}(?=\\s|$|[;&|])`, 'm');
const deny = (reason) => ({ decision: 'deny', reason });

// Branches a `git push` would update. A bare push (or HEAD) updates the current branch.
function pushTargets(command, current) {
  const match = command.match(/\bgit\s+(?:-C\s+\S+\s+)*push\b([^;&|\n]*)/);
  if (!match) return [];
  const words = match[1].trim().split(/\s+/).filter(Boolean);
  if (words.some((w) => w === '-d' || w === '--delete')) return [];
  const [, ...refspecs] = words.filter((w) => !w.startsWith('-'));
  if (!refspecs.length) return [current];
  return refspecs.map((spec) => {
    const dest = spec.replace(/^\+/, '').split(':').pop().replace(/^refs\/heads\//, '');
    return dest === 'HEAD' ? current : dest;
  });
}

export function check(input, currentBranch) {
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};

  if (tool === 'Bash') {
    const command = String(args.command ?? '');
    const branch = currentBranch();
    if (git('commit').test(command)) {
      if (ATTRIBUTION.test(command)) {
        return deny('No AI attribution in commits (CLAUDE.md): remove the Co-Authored-By / Claude-Session lines.');
      }
      const createsBranch = /\b(?:switch\s+(?:-c|-C|--create)|checkout\s+-[bB])\s/.test(command);
      if (!createsBranch && isProtected(branch)) {
        return deny(`Don't commit on \`${branch}\`. Create a ${PREFIXES} branch from origin/main first.`);
      }
    }
    if (git('push').test(command)) {
      const target = pushTargets(command, branch).find(isProtected);
      if (target) return deny(`Don't push to \`${target}\`. Push a ${PREFIXES} branch and open a PR.`);
    }
    if (git('merge').test(command) && branch === 'main') {
      return deny('Never merge into main locally; main changes only through merged PRs.');
    }
    return null;
  }

  if (/^mcp__github__(push_files|create_or_update_file|delete_file)$/.test(tool)) {
    if (isProtected(String(args.branch ?? ''))) {
      return deny(`Don't write to \`${args.branch}\`. Use a ${PREFIXES} branch and open a PR.`);
    }
    if (ATTRIBUTION.test(String(args.message ?? ''))) return deny('No AI attribution in commit messages (CLAUDE.md).');
    return null;
  }

  if (/^mcp__github__(create_pull_request|update_pull_request)$/.test(tool)) {
    if (ATTRIBUTION.test(`${args.title ?? ''}\n${args.body ?? ''}`)) {
      return deny('No AI attribution in PR titles or descriptions (CLAUDE.md): remove the "Generated with" / session lines.');
    }
    return null;
  }

  if (tool === 'mcp__github__merge_pull_request') {
    return { decision: 'ask', reason: 'Merges need the maintainer\'s go-ahead, with CI green (CLAUDE.md).' };
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
    const currentBranch = () => {
      try {
        return execFileSync('git', ['branch', '--show-current'], { cwd: input.cwd || root, encoding: 'utf8' }).trim();
      } catch {
        return '';
      }
    };
    const result = check(input, currentBranch);
    if (!result) return;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: result.decision,
          permissionDecisionReason: result.reason,
        },
      }),
    );
  });
}
