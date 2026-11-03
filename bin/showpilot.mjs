#!/usr/bin/env node
// showpilot <command> [options]: see `showpilot help`, or run `showpilot` alone for a menu. Every command runs with
// the project folder (--project, default the current folder) and SHOWPILOT_HOME in the environment, with each tool's
// caches moved into SHOWPILOT_HOME, and heavy stages (voice, record, render, dub) holding a lock so they never run at
// the same time. Before a command runs, what it needs (Node, ffmpeg, the browser, the voice) is checked, and the
// browser is downloaded automatically the first time it is needed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statfsSync } from 'node:fs';
import path from 'node:path';
import { isatty } from 'node:tty';
import { fileURLToPath } from 'node:url';

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(`Showpilot needs Node 20 or later (this is ${process.versions.node}). Install a current version from https://nodejs.org and try again.`);
  process.exit(1);
}

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
const { env, PKG, PROJECT, PYTHON, REDIRECTS } = await import('../src/paths.mjs');
const { acquire, release } = await import('../src/cli/lock.mjs');

// Every command starts with friendly.mjs, so a failure is a sentence rather than a stack trace.
const friendly = ['--import', new URL('../src/cli/friendly.mjs', import.meta.url).href];
const ts = (file) => [process.execPath, [...friendly, '--import', import.meta.resolve('tsx'), path.join(PKG, file)]];
const js = (file) => [process.execPath, [...friendly, path.join(PKG, file)]];
const playwrightCli = path.join(path.dirname(fileURLToPath(import.meta.resolve('playwright'))), 'cli.js');
const SETUP_BROWSER = [process.execPath, [playwrightCli, 'install', 'chromium']];

/** name → [what it does, how to run it, the lock it holds] */
const COMMANDS = {
  start: ['Guided start: sets Showpilot up for your project, or shows a menu if it already is', ts('src/cli/start.ts')],
  new: ['Start a video: asks its purpose, length, tone, narrator and who writes the script', ts('src/cli/new.ts')],
  make: ['Make a video from start to finish: check, narrate, record, render', ts('src/cli/make.ts')],
  assistant: ['Install the guide your AI coding assistant uses to write videos (Claude Code skill, AGENTS.md)', ts('src/cli/assistant.ts')],
  script: ['Turn the script you wrote (cuts/<id>.script.md) into a cut', ts('src/cli/script.ts')],
  init: ['Create a minimal project here: showpilot.config.ts, a first cut and .gitignore', js('src/cli/init.mjs')],
  doctor: ['Check Node, Python, ffmpeg, the browser and the voice setup', js('src/cli/doctor.mjs')],
  where: ['List every folder Showpilot uses, with sizes', js('src/cli/where.mjs')],
  'setup-browser': ['Download the Chromium that Playwright drives (into SHOWPILOT_HOME)', SETUP_BROWSER],
  'setup-voice': ['Create the Python environment and download Kokoro (into SHOWPILOT_HOME)', js('src/voice/setup.mjs')],
  voices: ['Hear the narrators and pick one (a page with buttons, or a number here)', ts('src/cli/voices.ts'), 'voice'],
  check: ['Load the config and a cut, and list its chapters and lines (no browser)', ts('src/cli/check.ts')],
  listen: ['Listen back to the narration and list words the narrator says wrongly', ts('src/cli/listen.ts'), 'voice'],
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

function printHelp() {
  console.log('Usage: showpilot <command> [cut] [options] [--project <dir>] [--home <dir>]\n       showpilot            (no command: a menu)\n');
  for (const [name, [what]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(14)} ${what}`);
  console.log('\nNew here? `showpilot new` asks a few questions and sets everything up. `showpilot doctor` checks your setup.');
  console.log('SHOWPILOT_HOME (default ~/.showpilot) holds the browser, the voice and every cache; delete it to uninstall.');
}

// ───────── Preflight: what a command needs, checked before it starts ─────────
const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const hasBrowser = () => {
  const dir = REDIRECTS.PLAYWRIGHT_BROWSERS_PATH;
  return existsSync(dir) && readdirSync(dir).some((d) => d.startsWith('chromium'));
};
const FFMPEG_HELP = {
  win32: 'Install it from https://www.gyan.dev/ffmpeg/builds/ (the "full" build), unzip it, and add its bin folder to PATH. Or: winget install Gyan.FFmpeg',
  darwin: 'Install it with: brew install ffmpeg',
  linux: 'Install it with your package manager, e.g.: sudo apt install ffmpeg',
}[process.platform] ?? 'Install it from https://ffmpeg.org/download.html';

function preflight(command) {
  if (['voice', 'voices', 'listen', 'dub', 'align', 'dictate'].includes(command) && !hasFfmpeg()) {
    console.error(`"${command}" needs ffmpeg, which isn't installed (or isn't on your PATH).\n${FFMPEG_HELP}\nThen run the command again; \`showpilot doctor\` checks it.`);
    process.exit(1);
  }
  if (['voice', 'voices', 'listen'].includes(command) && !existsSync(PYTHON)) {
    console.error('The narrator isn\'t set up yet. Run `showpilot setup-voice` once (it downloads Kokoro, about 1–3 GB), then try again.\nNo narrator wanted? Make the video silent: set `silent: true` in the cut (the viewer gets subtitles).');
    process.exit(1);
  }
  if (command === 'record' && !hasBrowser()) {
    console.log('First time recording: downloading the browser Showpilot films with (about 700 MB, once, stored in SHOWPILOT_HOME)…\n');
    const [cmd, base] = SETUP_BROWSER;
    if (spawnSync(cmd, base, { stdio: 'inherit', env: env() }).status) {
      console.error('\nThe browser download failed. Check your internet connection and run `showpilot setup-browser` to retry.');
      process.exit(1);
    }
  }
  if (command === 'render' || command === 'make' || command === 'record') {
    // Recording and rendering write many files; a full disk fails late and confusingly.
    try {
      const s = statfsSync(PROJECT);
      const gb = (s.bavail * s.bsize) / 1e9;
      if (gb < 3) console.error(`Warning: only ${gb.toFixed(1)} GB free on this drive. Recording and rendering can need several GB.\n`);
    } catch {
      /* the check is a courtesy; carry on without it */
    }
  }
}

// With no command in a terminal, a guided start sets things up (or shows a menu if it already is).
// (isatty(0) is asked instead of process.stdin.isTTY, which would open the terminal's input in this launcher, and an
// open input here takes keystrokes meant for the command it starts.)
const command = args.shift() ?? (isatty(0) ? 'start' : undefined);
if (!command || command === 'help' || command === '--help' || command === '-h' || !COMMANDS[command]) {
  const asked = command && !['help', '--help', '-h'].includes(command);
  if (asked) console.error(`Unknown command: ${command}\n`);
  printHelp();
  process.exit(asked ? 1 : 0);
}

mkdirSync(REDIRECTS.TEMP, { recursive: true }); // the browser download (in preflight) needs it on a fresh install
preflight(command);
const [, [cmd, base], lock] = COMMANDS[command];
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
