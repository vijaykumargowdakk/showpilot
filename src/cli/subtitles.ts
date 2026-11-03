// Subtitles and script for a cut: showpilot subtitles <cut>   (also written at the end of every render)
// out/<cut>/<cut>.srt          subtitles, named like the video so VLC turns them on with it
// out/<cut>/<cut>-script.md    every line with the time it appears, by chapter
// out/<cut>/chapters.txt       chapter start times for a YouTube description
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { planCut, type RenderPlan } from '../video/plan';
import { toSrt, type Cue } from '../video/subtitles';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function writeSubtitles(dir: string, plan: RenderPlan, title: string): string[] {
  const cues: Cue[] = [];
  const script = [`# ${title}`, '', `Every line with the time it appears in \`${plan.cut}.mp4\` (${mmss(plan.frames / plan.fps)} in all).`, ''];
  const chapters: string[] = [];
  let start = 0;
  for (const ch of plan.chapters) {
    const at = (f: number) => (start + f) / plan.fps;
    const name = ch.number ? `${ch.number}. ${ch.title}` : ch.title;
    chapters.push(`${mmss(at(0))} ${name}`);
    script.push(`## ${mmss(at(0))} · ${name}`, '');
    for (const l of ch.lines) script.push(`**[${mmss(at(l.f))}]** ${l.text}`, '');
    for (const p of ch.phrases) cues.push({ start: at(p.f), end: at(Math.min(p.to, ch.frames)), text: p.words.map((w) => w.w).join(' ') });
    start += ch.frames;
  }
  const files = [path.join(dir, `${plan.cut}.srt`), path.join(dir, `${plan.cut}-script.md`), path.join(dir, 'chapters.txt')];
  writeFileSync(files[0], toSrt(cues));
  writeFileSync(files[1], script.join('\n'));
  writeFileSync(files[2], chapters.join('\n') + '\n');
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadConfig, loadCut } = await import('../config');
  const { OUT } = await import('../paths.mjs');
  const config = await loadConfig();
  const cut = await loadCut(process.argv[2]);
  for (const f of writeSubtitles(path.join(OUT, cut.id), planCut(cut, config.brand), cut.title)) console.log(`→ ${f}`);
}
