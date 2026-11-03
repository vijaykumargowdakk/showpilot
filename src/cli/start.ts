// `showpilot` with no command, in a terminal: a guided start that does the setup for you.
//  - In a project that already has Showpilot set up (here or in ./video): a menu (make a video, new video, …).
//  - Anywhere else: asks where to put things and how to reach your app (suggesting a web address or build folder from
//    your package.json), creates the folder, installs Showpilot there, and carries on into `showpilot new`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { detectApp, slug, type PackageJson } from '../guide/detect';
import { createUi } from '../guide/ui';
import { PKG, PROJECT } from '../paths.mjs';

const bin = path.join(PKG, 'bin', 'showpilot.mjs');
const version = (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version;

/** Runs another showpilot command in a project, with the terminal handed over to it. */
const showpilot = (project: string, ...argv: string[]) => spawnSync(process.execPath, [bin, ...argv, '--project', project], { stdio: 'inherit', env: process.env }).status === 0;
const isProject = (dir: string) => existsSync(path.join(dir, 'showpilot.config.ts'));
const readJson = (file: string): PackageJson | null => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as PackageJson) : null);

const existing = [PROJECT, path.join(PROJECT, 'video')].find(isProject);
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

  const where = await ui.select('Where should the video setup live?', [
    { value: 'video', label: 'In a new "video" folder', hint: 'recommended: your app stays untouched' },
    { value: 'here', label: 'Right here, in this folder' },
  ]);
  const dir = where === 'video' ? path.join(PROJECT, 'video') : PROJECT;

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
  const packageFile = path.join(dir, 'package.json');
  if (!existsSync(packageFile)) {
    writeFileSync(packageFile, JSON.stringify({ name: `${slug(name)}-videos`, private: true, type: 'module', description: `Showpilot videos for ${name}` }, null, 2) + '\n');
    console.log(`  created  ${path.relative(PROJECT, packageFile) || 'package.json'}`);
  }
  if (!existsSync(path.join(dir, 'node_modules', 'showpilot'))) {
    // The cuts import from 'showpilot', so it has to be installed next to them.
    console.log('\nInstalling Showpilot there (a minute)…');
    const spec = process.env.SHOWPILOT_INSTALL_SPEC ?? `showpilot@^${version}`;
    const installed = spawnSync('npm', ['install', '--save-dev', JSON.stringify(spec)], { cwd: dir, stdio: 'inherit', shell: true });
    if (installed.status) throw new Error(`could not install Showpilot in ${dir}. Check your internet connection and run \`npm install --save-dev showpilot\` there.`);
  }

  console.log("\nGreat. Now the video itself.");
  const ok = showpilot(dir, 'new', '--app', app, '--name', name);
  if (how === 'url' && ok) console.log(`\nBefore you record: start your app${guess.devCommand ? ` (${guess.devCommand})` : ''} so it answers at ${app}.`);
  if (ok) console.log(`\nTo come back to this later, run \`npx showpilot\`${dir === PROJECT ? '' : ' in this folder, or in the video folder'}.`);
  process.exit(ok ? 0 : 1);
}
