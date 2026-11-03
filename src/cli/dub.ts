// Dubbing: showpilot dub <cut>   (after showpilot voice <cut>)
// Lays the narration over a silent cut that is already rendered, without rendering it again: each line's clip starts
// where its subtitle starts, and the video stream is copied as it is. Writes out/<cut>/<cut>-voiced.mp4 and
// <cut>-voiced.srt, whose subtitles follow the voice rather than the reading-time estimate. Lines that run past their
// slot are sped up a little, and the next line waits if needed, so no two lines ever overlap.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT, TMP } from '../paths.mjs';
import { beatId } from '../recorder/script';
import { planCut } from '../video/plan';
import { toSrt, type Caption, type Cue } from '../video/subtitles';

type Voice = Record<string, { file: string; duration: number; captions: Caption[] }>;

const config = await loadConfig();
const cut = await loadCut(process.argv[2]);
const cutId = cut.id;
if (!cut.silent) throw new Error(`${cutId} is not a silent cut; its narration is already in the render`);
const dir = path.join(OUT, cutId);
const video = path.join(dir, `${cutId}.mp4`);
const voiceFile = path.join(dir, 'voice', 'voice.json');
if (!existsSync(video)) throw new Error(`Render it first: showpilot render ${cutId}`);
if (!existsSync(voiceFile)) throw new Error(`Generate the narration first: showpilot voice ${cutId}`);
const voice: Voice = JSON.parse(readFileSync(voiceFile, 'utf8'));

// The silent plan is the timing the video was rendered with, so it says where every line starts.
const plan = planCut(cut, config.brand);
const clips: { id: string; start: number; slot: number; file: string; duration: number; captions: Caption[] }[] = [];
let offset = 0;
plan.chapters.forEach((ch, ci) => {
  const ids = cut.chapters[ci].beats.flatMap((b, bi) => (b.say ? [beatId(ci, bi)] : []));
  if (ids.length !== ch.lines.length) throw new Error(`Chapter ${ci + 1}: ${ids.length} lines in the cut, ${ch.lines.length} in the plan`);
  ch.lines.forEach((line, k) => {
    const v = voice[ids[k]];
    if (!v) throw new Error(`No narration for ${ids[k]}; run showpilot voice ${cutId}`);
    const start = (offset + line.f) / plan.fps;
    const next = (offset + (ch.lines[k + 1]?.f ?? ch.frames)) / plan.fps;
    clips.push({ id: ids[k], start, slot: next - start, ...v });
  });
  offset += ch.frames;
});
const total = plan.frames / plan.fps;

// Spoken lines can run longer than the reading time they were paced for. Such a line is sped up a little (pitch
// kept), and if it still runs over, the next line waits for it, using the pause most lines leave at their end.
const GAP = 0.25;
const MAX_TEMPO = 1.12;
let end = 0;
const timed = clips.map((c) => {
  const tempo = Math.min(MAX_TEMPO, Math.max(1, c.duration / Math.max(0.5, c.slot - GAP)));
  const at = Math.max(c.start, end + GAP);
  end = at + c.duration / tempo;
  return { ...c, tempo, at, end };
});
const late = timed.filter((c) => c.at > c.start + 0.05);
for (const c of timed.filter((x) => x.tempo > 1 || x.at > x.start + 0.05))
  console.log(`  ${c.id} at ${c.start.toFixed(1)} s: ${c.tempo > 1 ? `×${c.tempo.toFixed(2)}` : '     '}${c.at > c.start + 0.05 ? `  starts ${(c.at - c.start).toFixed(1)} s late` : ''}`);
if (timed.at(-1)!.end > total) throw new Error(`The narration ends ${(timed.at(-1)!.end - total).toFixed(1)} s after the video`);

// Rubber Band keeps the voice natural when sped up; some ffmpeg builds (e.g. Homebrew's) lack it, so atempo stands in.
const RUBBERBAND = (spawnSync('ffmpeg', ['-hide_banner', '-h', 'filter=rubberband'], { encoding: 'utf8' }).stdout ?? '').includes('Filter rubberband');
const stretch = (tempo: number) => (RUBBERBAND ? `rubberband=tempo=${tempo.toFixed(4)}` : `atempo=${tempo.toFixed(4)}`);

// One track: every clip delayed to its start and mixed without level changes (they never overlap). Copying the
// mono voice to both channels makes it about 2 dB louder, so the track is lowered by that to stay at -16 LUFS.
const filter = [
  ...timed.map((c, i) => `[${i + 1}:a]${c.tempo > 1 ? `${stretch(c.tempo)},` : ''}adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`),
  `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad,atrim=0:${total.toFixed(3)},aresample=48000,pan=stereo|c0=c0|c1=c0,volume=-2.1dB[out]`,
].join(';\n');
const script = path.join(TMP, `dub-${cutId}.txt`);
writeFileSync(script, filter);
const output = path.join(dir, `${cutId}-voiced.mp4`);
const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, ...clips.flatMap((c) => ['-i', c.file]), '-filter_complex_script', script];
const r = spawnSync('ffmpeg', [...args, '-map', '0:v', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', output], { stdio: 'inherit' });
if (r.status) process.exit(r.status);

// Subtitles that follow the voice: the same phrase breaks as the voiced cuts (a break, or eight words).
const cues: Cue[] = [];
for (const c of timed) {
  const t = (s: number) => c.at + s / c.tempo;
  let words: Caption[] = [];
  c.captions.forEach((w, i) => {
    words.push(w);
    if (w.brk || words.length >= 8 || i === c.captions.length - 1) {
      const next = c.captions[i + 1];
      cues.push({ start: t(words[0].start), end: next ? Math.min(t(next.start), t(w.end) + 0.6) : t(w.end) + 0.8, text: words.map((x) => x.w).join(' ') });
      words = [];
    }
  });
}
writeFileSync(path.join(dir, `${cutId}-voiced.srt`), toSrt(cues));
const drift = Math.max(...timed.map((c) => c.at - c.start));
console.log(`${timed.length} lines: ${timed.filter((c) => c.tempo > 1).length} sped up, ${late.length} start late (at most ${drift.toFixed(1)} s)\n→ ${output}\n→ ${path.join(dir, `${cutId}-voiced.srt`)}`);
