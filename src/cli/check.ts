// showpilot check <cut>: loads the config and the cut, and lists the chapters with their lines and a length estimate.
// It opens no browser, so it is quick, and CI can run it to catch a broken config or cut.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { formatLength, readBrief } from '../guide/brief';
import { PROJECT } from '../paths.mjs';
import { lineSeconds, narratedLines } from '../recorder/script';

const config = await loadConfig();
const cut = await loadCut(process.argv[2]);
const problems: string[] = [];

console.log(`${cut.title} (${cut.id})${cut.silent ? ', silent: paced for reading, with an .srt' : ''}`);
console.log(`App: ${config.app.serve ? `serves ${config.app.serve}` : config.app.url}   Brand: ${config.brand.name}\n`);
let total = 0;
cut.chapters.forEach((c, i) => {
  const lines = c.beats.filter((b) => b.say);
  const seconds = lines.reduce((n, b) => n + lineSeconds(cut, b.say!) + 0.65, 0);
  total += seconds;
  const kind = c.kind === 'scene' ? `scene: ${c.scene}${c.broll ? ' + b-roll' : ''}` : c.kind === 'web' ? `web: ${c.url}` : 'app';
  console.log(`  ${String(i + 1).padStart(2)}. ${c.title.padEnd(44)} ${String(lines.length).padStart(3)} lines  ~${Math.round(seconds)} s   (${kind})`);
  if (c.kind === 'scene' && !c.scene) problems.push(`chapter ${i + 1}: a scene needs a kind (kinetic, badges or cta)`);
  if (c.kind === 'web' && !c.url) problems.push(`chapter ${i + 1}: a web chapter needs a url`);
  if (c.scene === 'badges' && !c.props?.badges?.length) problems.push(`chapter ${i + 1}: a badges scene needs props.badges`);
});
if (!cut.silent && !config.voice) problems.push('this cut is narrated but showpilot.config.ts has no voice (or make the cut silent: true)');
if (cut.thumbnail && !cut.chapters[cut.thumbnail.chapter - 1]) problems.push(`thumbnail.chapter ${cut.thumbnail.chapter} does not exist`);
console.log(`\n${narratedLines(cut).length} lines, about ${Math.floor(total / 60)} min ${Math.round(total % 60)} s before actions are timed`);
// The brief's target length: more than 20% off is worth a rewrite before recording.
const briefFile = path.join(PROJECT, 'cuts', `${cut.id}.brief.md`);
if (existsSync(briefFile)) {
  const brief = readBrief(readFileSync(briefFile, 'utf8'));
  const off = total / brief.length - 1;
  const target = `the brief's ${formatLength(brief.length)}`;
  if (Math.abs(off) > 0.2) console.log(`  ~ ${Math.round(Math.abs(off) * 100)}% ${off > 0 ? 'longer' : 'shorter'} than ${target}: ${off > 0 ? 'trim lines or chapters' : 'add a moment or two'}, or change the brief`);
  else console.log(`  ok  close to ${target} (${brief.tone}, ${brief.purpose})`);
}
for (const p of problems) console.log(`  ! ${p}`);
process.exit(problems.length ? 1 : 0);
