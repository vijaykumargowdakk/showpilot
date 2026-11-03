// `showpilot` with no command, in a terminal: a guided start that does the setup for you.
//  - In a project that already has Showpilot set up (here or in ./video): a menu (make a video, new video, …).
//  - Anywhere else: asks where to save the videos (by default in a folder next to your project, so your code repository
//    is never touched) and how to reach your app (suggesting a web address or build folder from your package.json),
//    creates the folder, installs Showpilot there, remembers the link, and carries on into `showpilot new`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectApp, slug, type PackageJson } from '../guide/detect';
import { createUi } from '../guide/ui';
import { findLinked, link } from '../guide/registry';
import { HOME, PKG, PROJECT } from '../paths.mjs';

const bin = path.join(PKG, 'bin', 'showpilot.mjs');
const version = (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version;

/** Runs another showpilot command in a project, with the terminal handed over to it. */
const showpilot = (project: string, ...argv: string[]) => spawnSync(process.execPath, [bin, ...argv, '--project', project], { stdio: 'inherit', env: process.env }).status === 0;
const isProject = (dir: string) => existsSync(path.join(dir, 'showpilot.config.ts'));
const readJson = (file: string): PackageJson | null => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as PackageJson) : null);

const registry = path.join(HOME, 'projects.json');
const existing = [PROJECT, path.join(PROJECT, 'video'), findLinked(registry, PROJECT)].find((d) => d && isProject(d));
if (existing) await menu(existing);
else await setup();

async function menu(project: string) {
  const ui = createUi();
  const cutsDir = path.join(project, 'cuts');
  const cuts = existsSync(cutsDir) ? readdirSync(cutsDir).filter((f) => /^[\w-]+\.ts$/.test(f) && !f.endsWith('.actions.ts')).map((f) => f.slice(0, -3)) : [];
  console.log(`\nShowpilot: product videos from a script.  Project: ${project}`);
  type Action = 'make' | 'new' | 'voices' | 'doctor' | 'assistant' | 'help';
  const action = await ui.select<Action>('What would you like to do?', [
    ...(cuts.length ? [{ value: 'make' as const, label: 'Make a video from start to finish', hint: 'check, narrate, record, render' }] : []),
    { value: 'new', label: 'Start a new video', hint: 'a few questions' },
    { value: 'voices', label: 'Pick a narrator voice', hint: 'hear samples and choose' },
    { value: 'assistant', label: 'Update my AI assistant’s guide', hint: 'Claude Code, Cursor, Copilot, Codex' },
    { value: 'doctor', label: 'Check my setup' },
    { value: 'help', label: 'Show all commands' },
  ]);
  const cut = action === 'make' ? await ui.select('Which video?', cuts.map((c) => ({ value: c, label: c }))) : null;
  ui.close();
  process.exit(showpilot(project, ...(cut ? ['make', cut] : [action])) ? 0 : 1);
}

async function setup() {
  const ui = createUi();
  const pkg = readJson(path.join(PROJECT, 'package.json'));
  const guess = detectApp(pkg, path.basename(PROJECT), (f) => existsSync(path.join(PROJECT, f)));
  console.log(`\nWelcome to Showpilot: product demo videos from a script.\nLet's set it up${pkg ? ` for ${guess.name}` : ''}. It takes a minute, and I do the typing.`);

  // The videos go outside the code repository by default: your repo gets no new files, no new dependencies.
  const sibling = path.join(path.dirname(PROJECT), `${path.basename(PROJECT)}-videos`);
  const where = await ui.select('Where should your videos be saved?', [
    { value: 'beside', label: `Next to your project: ${sibling}`, hint: 'recommended: your code stays untouched' },
    { value: 'custom', label: 'Somewhere else (you type the folder)' },
    { value: 'inside', label: 'Inside your project, in a "video" folder', hint: 'your repo gets a new folder' },
  ]);
  let dir = sibling;
  if (where === 'inside') dir = path.join(PROJECT, 'video');
  if (where === 'custom') {
    const typed = await ui.text('Folder for your videos (created if it does not exist)', sibling);
    dir = path.resolve(PROJECT, typed.replace(/^~(?=$|[\\/])/, os.homedir()));
  }
  if (dir === PROJECT) throw new Error('Pick a different folder: Showpilot keeps its own files apart from your code.');

  const name = await ui.text('What is your product called?', guess.name);
  const how = await ui.select('How will Showpilot reach your app?', [
    { value: 'url', label: 'It runs on a web address', hint: guess.devCommand ? `start it with ${guess.devCommand}` : 'start your dev server first' },
    ...guess.builds.map((b) => ({ value: `build:${b}`, label: `Use the built folder "${b}"`, hint: 'nothing to start' })),
    { value: 'other', label: 'Something else' },
  ]);
  let app: string;
  if (how.startsWith('build:')) app = path.relative(dir, path.join(PROJECT, how.slice(6))).replace(/\\/g, '/');
  else app = await ui.text(how === 'url' ? 'Its web address' : 'Its web address, or a folder with its built files', guess.url);
  ui.close();

  mkdirSync(dir, { recursive: true });
  link(registry, PROJECT, dir);
  console.log(`  saving to ${dir}`);
  const packageFile = path.join(dir, 'package.json');
  if (!existsSync(packageFile)) {
    writeFileSync(packageFile, JSON.stringify({ name: `${slug(name)}-videos`, private: true, type: 'module', description: `Showpilot videos for ${name}` }, null, 2) + '\n');
    console.log(`  created  ${packageFile}`);
  }
  if (!existsSync(path.join(dir, 'node_modules', 'showpilot'))) {
    // The cuts import from 'showpilot', so it has to be installed next to them.
    console.log('\nInstalling Showpilot there (a minute)…');
    const spec = process.env.SHOWPILOT_INSTALL_SPEC ?? `showpilot@^${version}`;
    const installed = spawnSync('npm', ['install', '--save-dev', JSON.stringify(spec)], { cwd: dir, stdio: 'inherit', shell: true });
    if (installed.status) throw new Error(`could not install Showpilot in ${dir}. Check your internet connection and run \`npm install --save-dev showpilot\` there.`);
  }

  console.log("\nGreat. Now the video itself.");
  const ok = showpilot(dir, 'new', '--app', app, '--name', name, '--source', path.relative(dir, PROJECT).replace(/\\/g, '/'));
  if (how === 'url' && ok) console.log(`\nBefore you record: start your app${guess.devCommand ? ` (${guess.devCommand})` : ''} so it answers at ${app}.`);
  if (ok) console.log(`\nTo come back to this later, run \`npx showpilot\` in your project again (it remembers ${dir}).`);
  process.exit(ok ? 0 : 1);
}
