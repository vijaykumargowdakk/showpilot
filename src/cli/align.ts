// showpilot align <id> <recording> [--no-transcribe]
// Your own voice over a silent cut: render the cut, read out/<id>/<id>-script.md aloud while it plays (one take is
// fine), and this finds each line in the take, cleans it up, and places it where its subtitle appears, without
// rendering again. With dictation installed the lines are found from a transcript; otherwise from the pauses.
// Writes out/<id>/<id>-voiced.mp4 and <id>-voiced.srt.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT, PYTHON, VOICE_DIR } from '../paths.mjs';
import { planCut } from '../video/plan';
import { fit, lineSlots, mapBySilence, mapByWords, snapToSpeech, voicedCues, type Span } from '../video/placement';
import { estimateCaptions, toSrt } from '../video/subtitles';
import { mixOnto, report } from './mix';

// Like the generated narration: rumble cut, a little warmth and presence, gentle compression, -16 LUFS.
const MASTER = 'highpass=f=80,bass=g=2:f=140:w=0.7,equalizer=f=3200:t=q:w=1.2:g=1.5,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=150:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000';

const args = process.argv.slice(2);
const [id, recording] = args.filter((a) => !a.startsWith('--'));
if (!id || !recording) throw new Error('Usage: showpilot align <id> <your recording>');
const config = await loadConfig();
const cut = await loadCut(id);
if (!cut.silent) throw new Error(`${id} is narrated by the AI voice; make it silent: true to put your own voice on it`);
const dir = path.join(OUT, cut.id);
const video = path.join(dir, `${cut.id}.mp4`);
if (!existsSync(video)) throw new Error(`Render it first: showpilot render ${cut.id}`);
const take = path.resolve(recording);
if (!existsSync(take)) throw new Error(`No such recording: ${take}`);

const plan = planCut(cut, config.brand);
const slots = lineSlots(cut, plan);

/** Speech in the take: everything that isn't silence (ffmpeg silencedetect). */
function speechSpans(file: string): Span[] {
  const out = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'highpass=f=80,silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? '';
  const duration = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(out)?.slice(1).reduce((t, v, i) => t + Number(v) * [3600, 60, 1][i], 0) ?? 0);
  const marks = [...out.matchAll(/silence_(start|end): ([\d.]+)/g)].map((m) => ({ kind: m[1], t: Number(m[2]) }));
  const spans: Span[] = [];
  let from = 0;
  for (const m of marks) {
    if (m.kind === 'start') {
      if (m.t - from > 0.05) spans.push({ start: from, end: m.t });
    } else from = m.t;
  }
  if (marks.at(-1)?.kind !== 'start' && duration - from > 0.05) spans.push({ start: from, end: duration });
  return spans;
}

const speech = speechSpans(take);
let spans: (Span | null)[] | null = null;
let how = 'pauses';
if (!args.includes('--no-transcribe') && spawnSync(PYTHON, ['-c', 'import faster_whisper'], { env: process.env }).status === 0) {
  const json = path.join(dir, 'own', 'transcript.json');
  mkdirSync(path.dirname(json), { recursive: true });
  if (spawnSync(PYTHON, [path.join(VOICE_DIR, 'transcribe.py'), take, json, 'small.en'], { stdio: 'inherit', env: process.env }).status === 0) {
    const words = JSON.parse(readFileSync(json, 'utf8')).words;
    const byWords = mapByWords(slots.map((s) => s.say), words);
    // A transcript that misses many lines (a different take, heavy noise) is worse than the pauses.
    if (byWords.filter(Boolean).length >= slots.length * 0.7) [spans, how] = [snapToSpeech(byWords, speech), 'transcript'];
  }
}
spans ??= mapBySilence(slots, speech);

const clipsDir = path.join(dir, 'own');
mkdirSync(clipsDir, { recursive: true });
const missing: string[] = [];
const clips = slots.flatMap((s, i) => {
  const span = spans![i];
  if (!span || span.end - span.start < 0.2) {
    missing.push(`${s.id} at ${s.start.toFixed(1)} s`);
    return [];
  }
  const file = path.join(clipsDir, `${s.id}.wav`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(span.start), '-to', String(span.end), '-i', take, '-af', MASTER, '-ac', '1', file]);
  if (r.status) throw new Error(`Could not cut ${s.id} out of the recording`);
  const duration = span.end - span.start;
  return [{ ...s, file, duration, captions: estimateCaptions(s.say, duration) }];
});
if (!clips.length) throw new Error('No line was found in the recording. Was it read along with the video, from its start?');

const timed = fit(clips);
const summary = report(timed);
const output = path.join(dir, `${cut.id}-voiced.mp4`);
mixOnto(video, timed, plan.frames / plan.fps, output);
writeFileSync(path.join(dir, `${cut.id}-voiced.srt`), toSrt(voicedCues(timed)));
console.log(`Lines found from the ${how}. ${summary}`);
if (missing.length) console.log(`  ! not found in the take (left silent): ${missing.join(', ')}`);
console.log(`→ ${output}\n→ ${path.join(dir, `${cut.id}-voiced.srt`)}`);
