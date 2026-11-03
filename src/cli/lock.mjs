// One heavy stage at a time (voice, record, render, dub): a second stage refuses to start while a lock file exists in
// SHOWPILOT_HOME and the process that wrote it is still alive. The lock is shared by all projects, because the
// stages compete for the same CPU, GPU and memory.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { HOME } from '../paths.mjs';

const LOCK = path.join(HOME, '.busy');

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquire(stage) {
  mkdirSync(HOME, { recursive: true });
  if (existsSync(LOCK)) {
    const held = JSON.parse(readFileSync(LOCK, 'utf8'));
    if (alive(held.pid)) {
      console.error(`"${held.stage}" is still running (pid ${held.pid}, since ${held.since}). Heavy stages never run together; wait for it to finish.`);
      process.exit(1);
    }
  }
  writeFileSync(LOCK, JSON.stringify({ stage, pid: process.pid, since: new Date().toISOString() }));
}

export function release() {
  rmSync(LOCK, { force: true });
}
