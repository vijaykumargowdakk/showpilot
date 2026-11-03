// showpilot dub <cut>   (after showpilot voice <cut>)
// Lays the generated narration over a silent cut that is already rendered, without rendering it again: each line
// starts where its subtitle appears. Writes out/<cut>/<cut>-voiced.mp4 and <cut>-voiced.srt, timed to the voice.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT } from '../paths.mjs';
import { planCut } from '../video/plan';
import { fit, lineSlots, voicedCues } from '../video/placement';
import { toSrt, type Caption } from '../video/subtitles';
import { mixOnto, report } from './mix';

type Voice = Record<string, { file: string; duration: number; captions: Caption[] }>;

const config = await loadConfig();
const cut = await loadCut(process.argv[2]);
if (!cut.silent) throw new Error(`${cut.id} is not a silent cut; its narration is already in the render`);
const dir = path.join(OUT, cut.id);
const video = path.join(dir, `${cut.id}.mp4`);
const voiceFile = path.join(dir, 'voice', 'voice.json');
if (!existsSync(video)) throw new Error(`Render it first: showpilot render ${cut.id}`);
if (!existsSync(voiceFile)) throw new Error(`Generate the narration first: showpilot voice ${cut.id}`);
const voice: Voice = JSON.parse(readFileSync(voiceFile, 'utf8'));

// The silent plan is the timing the video was rendered with, so it says where every line starts.
const plan = planCut(cut, config.brand);
const clips = lineSlots(cut, plan).map((s) => {
  const v = voice[s.id];
  if (!v) throw new Error(`No narration for ${s.id}; run showpilot voice ${cut.id}`);
  return { ...s, ...v };
});
const timed = fit(clips);
const summary = report(timed);
const output = path.join(dir, `${cut.id}-voiced.mp4`);
mixOnto(video, timed, plan.frames / plan.fps, output);
writeFileSync(path.join(dir, `${cut.id}-voiced.srt`), toSrt(voicedCues(timed)));
console.log(`${summary}\n→ ${output}\n→ ${path.join(dir, `${cut.id}-voiced.srt`)}`);
