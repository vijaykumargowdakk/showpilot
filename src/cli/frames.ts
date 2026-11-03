// showpilot frames <cut> <chapter>:<beat>[:<seconds before the next beat>] ...
// A contact sheet of recorded screenshots, two to a row, taken at the end of each chosen beat (where its result should
// be on screen): out/<cut>/frames-<first>.jpg. Beats count from 0. Use it to check a take before rendering.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadCut } from '../config';
import { OUT } from '../paths.mjs';

type Timeline = { duration: number; shots: { t: number; file: string }[]; events: { type: string; t: number }[] };

const [cutId, ...specs] = process.argv.slice(2);
const cut = await loadCut(cutId);
if (!specs.length) throw new Error('Usage: showpilot frames <cut> 3:0 3:2 4:1:1.5   (chapter:beat[:seconds before the next beat])');
const files = specs.map((spec) => {
  const [ch, beat, before = '0.4'] = spec.split(':');
  const dir = path.join(OUT, cut.id, `ch${ch.padStart(2, '0')}`);
  const tl = JSON.parse(readFileSync(path.join(dir, 'timeline.json'), 'utf8')) as Timeline;
  const beats = tl.events.filter((e) => e.type === 'beat');
  const t = (beats[Number(beat) + 1]?.t ?? tl.duration) - Number(before);
  return path.join(dir, 'frames', tl.shots.filter((x) => x.t <= t).pop()!.file);
});
const filters = files.map((_, i) => `[${i}]scale=960:540[v${i}]`);
const rows: string[] = [];
for (let i = 0; i < files.length; i += 2) {
  if (files[i + 1]) filters.push(`[v${i}][v${i + 1}]hstack[r${i}]`);
  else filters.push(`color=black:960x540:d=1[e${i}]`, `[v${i}][e${i}]hstack[r${i}]`);
  rows.push(`[r${i}]`);
}
filters.push(rows.length > 1 ? `${rows.join('')}vstack=${rows.length}[out]` : `${rows[0]}null[out]`);
const output = path.join(OUT, cut.id, `frames-${specs[0].replaceAll(':', '_')}.jpg`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', output]);
console.log(`→ ${output}`);
