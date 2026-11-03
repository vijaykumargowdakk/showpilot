#!/usr/bin/env node
// showpilot <command> [options]: see `showpilot help`. Every command runs with the project folder (--project, default
// the current folder) and SHOWPILOT_HOME in the environment, with each tool's caches moved into SHOWPILOT_HOME, and
// heavy stages (voice, record, render, dub) holding a lock so they never run at the same time.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const project = take('--project');
const home = take('--home');
if (project) process.env.SHOWPILOT_PROJECT = path.resolve(project);
if (home) process.env.SHOWPILOT_HOME = path.resolve(home);

// Imported after the flags are applied, because paths.mjs reads them once.
const { env, PKG, PYTHON, REDIRECTS } = await import('../src/paths.mjs');
const { acquire, release } = await import('../src/cli/lock.mjs');

const ts = (file) => [process.execPath, ['--import', import.meta.resolve('tsx'), path.join(PKG, file)]];
const js = (file) => [process.execPath, [path.join(PKG, file)]];

/** name → [what it does, how to run it, the lock it holds] */
const COMMANDS = {
  new: ['Start a video: asks its purpose, length, tone, narrator and who writes the script', ts('src/cli/new.ts')],
  assistant: ['Install the guide your AI coding assistant uses to write videos (Claude Code skill, AGENTS.md)', ts('src/cli/assistant.ts')],
  script: ['Turn the script you wrote (cuts/<id>.script.md) into a cut', ts('src/cli/script.ts')],
  init: ['Create a minimal project here: showpilot.config.ts, a first cut and .gitignore', js('src/cli/init.mjs')],
  doctor: ['Check Node, Python, ffmpeg, the browser and the voice setup', js('src/cli/doctor.mjs')],
  where: ['List every folder Showpilot uses, with sizes', js('src/cli/where.mjs')],
  'setup-browser': ['Download the Chromium that Playwright drives (into SHOWPILOT_HOME)', [process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.resolve('playwright'))), 'cli.js'), 'install', 'chromium']]],
  'setup-voice': ['Create the Python environment and download Kokoro (into SHOWPILOT_HOME)', js('src/voice/setup.mjs')],
  voices: ['Hear the narrators and pick one (a page with buttons, or a number here)', ts('src/cli/voices.ts'), 'voice'],
  check: ['Load the config and a cut, and list its chapters and lines (no browser)', ts('src/cli/check.ts')],
  voice: ['Speak every line of a cut with the configured voice', ts('src/cli/voice.ts'), 'voice'],
  record: ['Drive the app and record each chapter (--chapter N, --from N)', ts('src/recorder/record.ts'), 'record'],
  render: ['Render the video (--clean: no captions or audio; --still 300,900: frames as PNGs)', ts('src/cli/render.ts'), 'render'],
  thumbnail: ["Render the cut's thumbnail variants as JPEGs", ts('src/cli/thumbnail.ts'), 'render'],
  subtitles: ['Write the .srt, the timestamped script and the chapter list', ts('src/cli/subtitles.ts')],
  dub: ['Lay narration over a rendered silent cut, without rendering again', ts('src/cli/dub.ts'), 'dub'],
  frames: ['Contact sheet of recorded frames, to check a take (ch:beat ...)', ts('src/cli/frames.ts')],
  dictate: ['Talk the video through (--record, or an audio file); it becomes cuts/<id>.script.md', ts('src/cli/dictate.ts')],
  align: ['Put your own recorded voiceover on a rendered silent cut, line by line', ts('src/cli/align.ts'), 'dub'],
};

const command = args.shift();
if (!command || command === 'help' || command === '--help' || !COMMANDS[command]) {
  if (command && !['help', '--help'].includes(command)) console.error(`Unknown command: ${command}\n`);
  console.log('Usage: showpilot <command> [cut] [options] [--project <dir>] [--home <dir>]\n');
  for (const [name, [what]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(14)} ${what}`);
  console.log('\nSHOWPILOT_HOME (default ~/.showpilot) holds the browser, the voice and every cache; delete it to uninstall.');
  process.exit(command && !['help', '--help'].includes(command) ? 1 : 0);
}

const [, [cmd, base], lock] = COMMANDS[command];
mkdirSync(REDIRECTS.TEMP, { recursive: true });
if (lock) acquire(lock);
let status = 1;
try {
  const r = spawnSync(cmd, [...base, ...args], { stdio: 'inherit', env: env() });
  if (r.error) console.error(r.error.code === 'ENOENT' && cmd === PYTHON ? 'The voice is not set up yet: run `showpilot setup-voice`.' : r.error.message);
  status = r.status ?? 1;
} finally {
  if (lock) release();
}
process.exit(status);
