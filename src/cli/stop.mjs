// Stopping a command and everything it started. A terminal's Ctrl+C reaches the whole process group, but a signal sent
// to the launcher alone (an IDE's stop button, `kill`) would leave the command, and whatever it started (the browser,
// Remotion, Python), running, and the stage lock would look stale while it still works. So the launcher stops the
// command's whole process tree itself, and holds the lock until the command has exited.
import { spawnSync } from 'node:child_process';

/** Every process below `root`, given [pid, parent pid] rows from `ps`. */
export function descendants(root, rows) {
  const children = new Map();
  for (const [pid, ppid] of rows) children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  const found = [];
  const seen = new Set([root]);
  const walk = (pid) => {
    for (const c of children.get(pid) ?? []) {
      if (seen.has(c)) continue;
      seen.add(c);
      found.push(c);
      walk(c);
    }
  };
  walk(root);
  return found;
}

function psRows() {
  const out = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).stdout ?? '';
  return out
    .split('\n')
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((row) => row.length === 2 && row.every(Number.isInteger));
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Sends `signal` to `pid` and every process below it, and returns them all, so stragglers can be killed later. The
 * tree is read before anything is signalled: once a parent exits, its children are re-parented and can't be found.
 * On Windows, taskkill ends the whole tree at once.
 */
export function signalTree(pid, signal) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return [];
  }
  const tree = [pid, ...descendants(pid, psRows())];
  for (const p of tree) {
    try {
      process.kill(p, signal);
    } catch {
      // already gone
    }
  }
  return tree;
}

/** Waits up to `ms` for the processes to exit, then kills any that are left. */
export async function reap(pids, ms) {
  const until = Date.now() + ms;
  while (pids.some(alive) && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  for (const p of pids.filter(alive)) {
    try {
      process.kill(p, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}
