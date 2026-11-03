// showpilot new [id]: starts a video by asking what it is for, how long, in what tone, who narrates it and who writes
// the script; writes cuts/<id>.brief.md (and showpilot.config.ts if there is none), then hands over: the voice picker,
// your AI assistant's guide, a script file to fill in, or dictation. Every question has a flag, so an assistant or a
// script can run it without a terminal (add --yes to take the defaults for anything not given).
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { installAssistantGuide } from '../guide/assistant';
import { AUTHORS, formatLength, NARRATIONS, parseLength, PURPOSES, TONES, writeBrief, type Author, type Brief, type Narration, type Purpose, type Tone } from '../guide/brief';
import { PKG, PROJECT, PYTHON } from '../paths.mjs';
import { createUi } from '../guide/ui';
import { scriptTemplate } from '../script/markdown';

const argv = process.argv.slice(2);
const flag = (name: string) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);
const yes = argv.includes('--yes');
const id = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) ?? flag('id');
const ui = yes ? null : createUi();

async function ask(question: string, fallback: string): Promise<string> {
  return ui ? ui.text(question, fallback) : fallback;
}

async function choose<T extends string>(flagName: string, question: string, options: readonly T[], labels: Record<T, string>, fallback: T): Promise<T> {
  const given = flag(flagName);
  if (given) {
    if (!options.includes(given as T)) throw new Error(`--${flagName} must be one of ${options.join(', ')}`);
    return given as T;
  }
  if (!ui) return fallback;
  return ui.select<T>(question, options.map((o) => ({ value: o, label: labels[o] })), options.indexOf(fallback));
}

console.log('A new Showpilot video. Press Enter to take the suggestion.');
const name = id ?? (await ask('A short name for the video (its file name)', 'launch'));
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`"${name}": use lowercase letters, digits and dashes`);

// The config, if this is the project's first video.
const configFile = path.join(PROJECT, 'showpilot.config.ts');
if (!existsSync(configFile)) {
  const app = flag('app') ?? (await ask('Where is the app? A URL, or a folder with its production build', 'http://localhost:5173'));
  const brand = flag('name') ?? (await ask("The product's name", path.basename(PROJECT)));
  const where = /^https?:\/\//.test(app) ? `url: ${JSON.stringify(app)}` : `serve: ${JSON.stringify(app)}`;
  writeFileSync(
    configFile,
    `import { defineConfig } from 'showpilot';

export default defineConfig({
  // ready: a selector that is on screen once the app is ready to film.
  app: { ${where}, ready: 'body' },
  brand: { name: ${JSON.stringify(brand)}, links: [] },
  // The narrator: \`showpilot voices\` lets you hear them all and writes your pick on the line below.
  // showpilot:voice
  // voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
});
`,
  );
  console.log(`  created  showpilot.config.ts`);
}

const purpose = await choose<Purpose>('purpose', 'Purpose: what kind of video?', PURPOSES, { launch: 'Launch: make people want it', walkthrough: 'Walkthrough: show the main features', tutorial: 'Tutorial: teach one task step by step', update: "Update: what's new in a release" }, 'launch');
const audience = flag('audience') ?? (await ask('Who is it for?', purpose === 'tutorial' ? 'new users' : 'people who might use it'));
const lengthAnswer =
  flag('length') ??
  (await choose('length-choice', 'Length', ['teaser', 'short', 'demo', 'deep dive', 'custom'] as const, { teaser: 'Teaser, 60–90 s', short: 'Short, 2–3 min', demo: 'Demo, 5–6 min', 'deep dive': 'Deep dive, 10–15 min', custom: 'Another length' }, purpose === 'launch' ? 'teaser' : 'short'));
const length = parseLength(lengthAnswer === 'custom' ? await ask('How long? (e.g. 90s, 4m, 2:30)', '2m') : lengthAnswer);
const tone = await choose<Tone>('tone', 'Tone', Object.keys(TONES) as Tone[], { energetic: 'Energetic: bright, fast, enthusiastic', professional: 'Professional: clear and confident', friendly: 'Friendly: warm and relaxed', calm: 'Calm: slow and reassuring', playful: 'Playful: light and cheeky' }, purpose === 'launch' ? 'energetic' : 'friendly');
const narration = await choose<Narration>('narration', 'Who narrates it?', NARRATIONS, { ai: 'An AI voice (you pick one from samples)', own: 'Me: I record myself reading the script over the video', silent: 'Nobody: silent, with subtitles' }, length > 600 ? 'silent' : 'ai');
const author = await choose<Author>('script', 'Who writes the script?', AUTHORS, { assistant: 'My AI coding assistant (it already knows the codebase)', self: 'Me, in a simple script file', dictate: 'Me, by talking it through (transcribed on this computer)' }, 'assistant');
const goals = flag('goals') ?? (await ask('What must it show? (Enter to fill in later)', ''));
// The product's name from the config (as written there), for the title.
const product = /brand:\s*\{[^}]*?name:\s*(['"])(.*?)\1/s.exec(readFileSync(configFile, 'utf8'))?.[2] ?? path.basename(PROJECT);
const brief: Brief = { id: name, title: flag('title') ?? `${product}: ${purpose}`, purpose, audience, length, tone, narration, author, goals: goals.replace(/;\s*/g, '\n- ').replace(/^(?=.)/, '- ') };
const briefFile = path.join(PROJECT, 'cuts', `${name}.brief.md`);
mkdirSync(path.dirname(briefFile), { recursive: true });
writeFileSync(briefFile, writeBrief(brief));
console.log(`\n  wrote    cuts/${name}.brief.md: a ${formatLength(length)} ${tone} ${purpose} video, ${{ ai: 'AI-narrated', own: 'narrated by you', silent: 'silent' }[narration]}`);
const ignore = path.join(PROJECT, '.gitignore');
if (!existsSync(ignore) || !readFileSync(ignore, 'utf8').split(/\r?\n/).includes('out/')) appendFileSync(ignore, '\n# Showpilot recordings, narration and videos\nout/\n');

const next: string[] = [];
if (author === 'assistant') {
  for (const f of installAssistantGuide(PROJECT)) console.log(`  wrote    ${path.relative(PROJECT, f)}`);
  next.push(`Ask your AI assistant: "Make the ${name} video with Showpilot, from cuts/${name}.brief.md."`, `  (Claude Code uses the Showpilot skill; Cursor, Copilot, Codex and others read AGENTS.md.)`);
} else {
  const scriptFile = path.join(PROJECT, 'cuts', `${name}.script.md`);
  if (author === 'self' && !existsSync(scriptFile)) {
    writeFileSync(scriptFile, scriptTemplate(brief.title));
    console.log(`  wrote    cuts/${name}.script.md (a template to fill in)`);
  }
  next.push(
    author === 'self'
      ? `Write the narration in cuts/${name}.script.md, then: npx showpilot script ${name}`
      : `Talk the video through: npx showpilot dictate ${name} --record   (or pass an audio file; needs npx showpilot setup-voice --dictation)`,
    `Then fill in the on-screen actions in cuts/${name}.actions.ts, or ask your AI assistant to (npx showpilot assistant installs its guide).`,
  );
}
if (narration === 'own') next.push(`Render it silent, read out/${name}/${name}-script.md aloud while it plays, then: npx showpilot align ${name} <your recording>`);

if (narration === 'ai') {
  const bin = path.join(PKG, 'bin', 'showpilot.mjs');
  const showpilot = (...a: string[]) => spawnSync(process.execPath, [bin, ...a, '--project', PROJECT], { stdio: 'inherit', env: process.env }).status === 0;
  if (!existsSync(PYTHON) && ui) {
    const go = await ui.confirm(`No narrator voice found in ${path.dirname(path.dirname(PYTHON))}. It is a one-time download (1–3 GB), shared by all your projects. Set it up now? (Already have one? Answer No and set SHOWPILOT_VENV to its folder.)`, false);
    ui.close();
    if (go) showpilot('setup-voice');
  }
  if (existsSync(PYTHON) && ui) {
    ui.close();
    console.log('\nNow pick the narrator from samples (a page opens; or choose by number here).');
    showpilot('voices', '--cut', name);
  } else if (!existsSync(PYTHON)) next.unshift(`Set up the narrator: npx showpilot setup-voice, then pick one: npx showpilot voices --cut ${name}`);
  else next.unshift(`Pick the narrator: npx showpilot voices --cut ${name}`);
}
ui?.close();

console.log(`\nNext:\n${next.map((n) => (n.startsWith('  ') ? n : `  • ${n}`)).join('\n')}`);
