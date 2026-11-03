// showpilot voices [--tone energetic] [--cut <id>] [--line "…"] [--voices all|male|female|id,…] [--speeds 1,0.92] [--no-pick]
// Renders a sample of each narrator (src/voice/audition.py), then lets you pick one in either of two ways at once: a
// local page with a "Use this voice" button on every sample, or a numbered list in the terminal. The choice is
// written into showpilot.config.ts. The sample line, and the energy of the chosen voice, follow the tone.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { readBrief, TONES, type Tone } from '../guide/brief';
import { setVoice, voiceLine, type VoiceChoice } from '../guide/config-edit';
import { OUT, PROJECT, PYTHON, VOICE_DIR } from '../paths.mjs';

type Sample = { id: string; accent: string; gender: string; mix: Record<string, number>; speed: number; file: string; seconds: number; pitch: number; grade: string };

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const briefFile = opt('--cut') && path.join(PROJECT, 'cuts', `${opt('--cut')}.brief.md`);
const brief = briefFile && existsSync(briefFile) ? readBrief(readFileSync(briefFile, 'utf8')) : null;
const tone = (opt('--tone') ?? brief?.tone ?? 'friendly') as Tone;
if (!TONES[tone]) throw new Error(`--tone must be one of ${Object.keys(TONES).join(', ')}`);
const { energy, line } = TONES[tone];

const audition = spawnSync(
  PYTHON,
  [path.join(VOICE_DIR, 'audition.py'), '--line', opt('--line') ?? line, '--voices', opt('--voices') ?? 'all', '--energy', String(energy), ...(opt('--speeds') ? ['--speeds', opt('--speeds')!] : [])],
  { stdio: 'inherit', env: process.env },
);
if (audition.error) throw new Error(audition.error.message.includes('ENOENT') ? 'The voice is not set up yet: run `showpilot setup-voice`.' : audition.error.message);
if (audition.status) process.exit(audition.status);
if (args.includes('--no-pick')) process.exit(0);

const dir = path.join(OUT, 'voices');
const samples = JSON.parse(readFileSync(path.join(dir, 'samples.json'), 'utf8')) as Sample[];
const choice = (s: Sample): VoiceChoice => ({ mix: s.mix, speed: s.speed, energy });

/** Writes the voice into the config; says what to paste if there is no config or no safe place in it. */
function use(s: Sample) {
  const file = path.join(PROJECT, 'showpilot.config.ts');
  const updated = existsSync(file) ? setVoice(readFileSync(file, 'utf8'), choice(s)) : null;
  if (updated) {
    writeFileSync(file, updated);
    console.log(`\nNarrator set to ${s.id} at ×${s.speed} (energy ${energy}, ${tone}) in showpilot.config.ts.`);
  } else console.log(`\nPut this in showpilot.config.ts, inside defineConfig({ … }):\n${voiceLine(choice(s))}`);
}

const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pick a narrator</title><style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--muted:#5b6472;--line:#e3e6eb;--accent:#0f766e}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#171b22;--ink:#e8ebf0;--muted:#9aa3b2;--line:#262c36;--accent:#5eead4}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 16px}h1{margin:0 0 4px;font-size:26px}p{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:20px}
article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
h2{margin:0;font-size:17px}.meta{margin:2px 0 8px;font-size:13px;color:var(--muted)}audio{width:100%}
button{margin-top:10px;width:100%;padding:10px;border:0;border-radius:8px;background:var(--accent);color:var(--bg);font:600 15px system-ui;cursor:pointer}
.done{padding:24px;border-radius:12px;background:var(--card);border:2px solid var(--accent);font-size:18px}
</style></head><body><main><h1>Pick a narrator</h1>
<p>Each sample reads the same ${tone} line. Listen, then choose one; it goes straight into showpilot.config.ts. (Or type its number in the terminal.)</p>
<div class="grid">${samples
  .map(
    (s, i) => `<article><h2>${i + 1}. ${s.id} <small>×${s.speed}</small></h2>
<p class="meta">${s.accent}, ${s.gender} · ~${Math.round(s.pitch)} Hz · Kokoro grade ${s.grade}</p>
<audio controls preload="none" src="/${s.file}"></audio><button data-i="${i}">Use this voice</button></article>`,
  )
  .join('')}</div></main><script>
for (const b of document.querySelectorAll('button')) b.onclick = async () => {
  await fetch('/pick?i=' + b.dataset.i, { method: 'POST' });
  const done = document.createElement('div');
  done.className = 'done';
  done.textContent = 'Done: ' + b.parentElement.querySelector('h2').textContent + ' is your narrator. You can close this page.';
  document.querySelector('main').replaceChildren(done);
};
</script></body></html>`;

let settle: (s: Sample | null) => void = () => {};
const picked = new Promise<Sample | null>((ok) => (settle = ok));

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/pick') {
    const s = samples[Number(url.searchParams.get('i'))];
    res.writeHead(s ? 204 : 400).end();
    if (s) settle(s);
    return;
  }
  const file = url.pathname === '/' ? null : path.join(dir, path.basename(url.pathname));
  if (file && existsSync(file)) return void res.writeHead(200, { 'content-type': 'audio/wav' }).end(readFileSync(file));
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page());
});
await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
const pageUrl = `http://localhost:${(server.address() as AddressInfo).port}/`;
const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', pageUrl]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [pageUrl]];
spawn(opener[0] as string, opener[1] as string[], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();

console.log(`\nPick a narrator: on the page that just opened (${pageUrl}), or by number here.\n`);
samples.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.id.padEnd(22)} ×${String(s.speed).padEnd(5)} ${s.accent}, ${s.gender}, ~${Math.round(s.pitch)} Hz`));
const rl = createInterface({ input: process.stdin, output: process.stdout });
void (async () => {
  for (;;) {
    const answer = (await rl.question('\nNumber of the voice to use (q to decide later): ').catch(() => 'q')).trim();
    if (answer === 'q' || answer === '') return settle(null);
    const s = samples[Number(answer) - 1];
    if (s) return settle(s);
    console.log(`Type a number from 1 to ${samples.length}.`);
  }
})();

const s = await picked;
rl.close();
server.close();
if (s) use(s);
else console.log(`\nNo narrator picked. The samples stay in ${dir}; run \`showpilot voices\` again to choose.`);
process.exit(0);
