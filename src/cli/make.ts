// showpilot make <cut>: the whole pipeline in one command, stage by stage (they never run together): check, narrate
// (AI-narrated cuts), record, render, and the thumbnail if the cut has one. Anything that fails stops the run with
// the stage's own message. `--from record` or `--from render` skips the stages before it.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { loadCut } from '../config';
import { OUT, PKG } from '../paths.mjs';

const args = process.argv.slice(2);
const cut = await loadCut(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--from'));
const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : 'check';
const order = ['check', 'voice', 'record', 'render', 'thumbnail'];
if (!order.includes(from)) throw new Error(`--from must be one of ${order.join(', ')}`);

const stages = order.filter((s) => (s !== 'voice' || !cut.silent) && (s !== 'thumbnail' || cut.thumbnail)).filter((s) => order.indexOf(s) >= order.indexOf(from));
const bin = path.join(PKG, 'bin', 'showpilot.mjs');
console.log(`Making "${cut.title}": ${stages.join(' → ')}\n`);
for (const [i, stage] of stages.entries()) {
  console.log(`\n[${i + 1}/${stages.length}] ${stage}`);
  const r = spawnSync(process.execPath, [bin, stage, cut.id], { stdio: 'inherit', env: process.env });
  if (r.status) throw new Error(`the ${stage} stage failed (see above). Fix it and run \`showpilot make ${cut.id} --from ${stage}\` to continue from there.`);
}
console.log(`\nDone. Your video is in ${path.join(OUT, cut.id)}: ${cut.id}.mp4, ${cut.id}.srt, ${cut.id}-script.md and chapters.txt.`);
