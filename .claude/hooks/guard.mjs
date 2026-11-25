// PreToolUse hook: enforces the git rules in CLAUDE.md for shell commands and GitHub tool calls.
// Fails open: if the input can't be read, the call goes ahead.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ATTRIBUTION = /co-authored-by:|claude-session:|generated with \[?claude/i;
const PREFIXES = '`feat/…`, `fix/…`, `docs/…` or `chore/…`';

const isProtected = (branch) => branch === 'main' || branch === 'master' || branch.startsWith('claude/');
const deny = (reason) => ({ decision: 'deny', reason });

/** A shell command cut at `&&`, `||`, `;`, `|` and newlines that are outside quotes. */
function splitCommand(command) {
  const parts = [];
  let part = '';
  let quote = '';
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === '\\' && quote === '"') part += c + (command[++i] ?? '');
      else {
        if (c === quote) quote = '';
        part += c;
      }
    } else if (c === '"' || c === "'") {
      quote = c;
      part += c;
    } else if (c === '\\') {
      part += c + (command[++i] ?? '');
    } else if ('&|'.includes(c) && command[i + 1] === c) {
      parts.push(part);
      part = '';
      i++;
    } else if (c === ';' || c === '|' || c === '\n') {
      parts.push(part);
      part = '';
    } else {
      part += c;
    }
  }
  return [...parts, part];
}

/**
 * The git commands in a shell command, in the order they run, as [subcommand, ...words]. A part counts only if it
 * starts with `git` (after any VAR=value), so text inside a commit message or a grep pattern isn't mistaken for one.
 */
function gitCommands(command) {
  return splitCommand(command)
    .map((part) => part.match(/^\s*(?:[A-Za-z_]\w*=\S*\s+)*git(?:\s+-C\s+\S+)*\s+([a-z][\w-]*)([\s\S]*)$/))
    .filter(Boolean)
    .map(([, sub, rest]) => [sub, ...rest.trim().split(/\s+/).filter(Boolean)]);
}

/** The branch a `git switch` or `git checkout` moves to, or undefined if it doesn't change branch. */
function switchedTo([sub, ...words], isBranch) {
  const after = (flags) => {
    const i = words.findIndex((w) => flags.includes(w));
    return i === -1 ? undefined : words[i + 1];
  };
  if (sub === 'switch') return after(['-c', '-C', '--create']) ?? words.find((w) => !w.startsWith('-'));
  if (sub !== 'checkout' || words.includes('--')) return undefined;
  const created = after(['-b', '-B']);
  if (created) return created;
  const [name, ...more] = words.filter((w) => !w.startsWith('-'));
  return name && !more.length && isBranch(name) ? name : undefined;
}

// Branches a `git push` would update. A bare push (or HEAD) updates the current branch.
function pushTargets(words, current) {
  if (words.some((w) => w === '-d' || w === '--delete')) return [];
  const [, ...refspecs] = words.filter((w) => !w.startsWith('-'));
  if (!refspecs.length) return [current];
  return refspecs.map((spec) => {
    const dest = spec.replace(/^\+/, '').split(':').pop().replace(/^refs\/heads\//, '');
    return dest === 'HEAD' ? current : dest;
  });
}

/**
 * Each git command is judged on the branch it runs on: the current one, or the one an earlier `git switch` or
 * `git checkout` in the same command moved to.
 */
function checkShell(command, currentBranch, isBranch) {
  let branch = currentBranch();
  for (const [sub, ...words] of gitCommands(command)) {
    branch = switchedTo([sub, ...words], isBranch) ?? branch;
    if (sub === 'commit') {
      if (ATTRIBUTION.test(command)) {
        return deny('No AI attribution in commits (CLAUDE.md): remove the Co-Authored-By / Claude-Session lines.');
      }
      if (isProtected(branch)) return deny(`Don't commit on \`${branch}\`. Create a ${PREFIXES} branch from origin/main first.`);
    }
    if (sub === 'push') {
      const target = pushTargets(words, branch).find(isProtected);
      if (target) return deny(`Don't push to \`${target}\`. Push a ${PREFIXES} branch and open a PR.`);
    }
    if (sub === 'merge' && branch === 'main' && !words.includes('--ff-only')) {
      return deny('Never merge into main locally; main changes only through merged PRs. (`git merge --ff-only` to catch up is fine.)');
    }
  }
  return null;
}

export function check(input, currentBranch, isBranch = () => false) {
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};

  if (tool === 'Bash') return checkShell(String(args.command ?? ''), currentBranch, isBranch);

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
    const isBranch = (name) =>
      ['refs/heads/', 'refs/remotes/origin/'].some((prefix) => {
        try {
          execFileSync('git', ['show-ref', '--verify', '--quiet', `${prefix}${name}`], { cwd: input.cwd || root });
          return true;
        } catch {
          return false;
        }
      });
    const result = check(input, currentBranch, isBranch);
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
