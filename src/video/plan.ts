// Turns a recorded cut into out/<cut>/render.json for the Remotion compositions: per-frame camera and cursor,
// click ripples, keycaps, callouts, narration clips and timed captions. Everything is in frames at 60 fps.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cameraTrack, type TimelineEvent } from './camera';
import type { Config } from '../config';
import type { Cut, SceneKind, SceneProps } from '../recorder/script';
import { OUT } from '../paths.mjs';
import { beatId, readSeconds, SCENE, voiceoverId } from '../recorder/script';
import { FPS, WIDE } from './geometry';
import { cleanText, estimateCaptions, type Caption } from './subtitles';

type Voice = Record<string, { file: string; duration: number; captions: Caption[] }>;
type Timeline = { title: string; duration: number; shots: { t: number; file: string }[]; events: (TimelineEvent & { id?: string; keys?: string[]; text?: string })[] };

export type CursorKind = 0 | 1; // 0 arrow, 1 grab
export type ChapterPlan = {
  title: string;
  /** 'capture' shows recorded screenshots; 'scene' is drawn (kinetic text, standards badges, closing card). */
  kind: 'capture' | 'scene';
  scene?: SceneKind;
  props?: SceneProps;
  /** Speed-up of a capture (speed-run), shown with a timer. */
  speed?: number;
  /** Every narrated word with its frame, for scenes that react to what is said. */
  words?: { w: string; f: number }[];
  /** Folder of the chapter's screenshots, relative to out/. */
  dir: string;
  files: string[];
  /** Index into files for every frame. */
  shot: number[];
  frames: number;
  /** s, x, y per frame */
  cam: number[];
  /** x, y, opacity, pressed (0/1), kind per frame */
  cursor: number[];
  ripples: { f: number; x: number; y: number }[];
  keys: { f: number; keys: string[] }[];
  callouts: { f: number; to: number; box: { x: number; y: number; width: number; height: number }; text: string }[];
  audio: { f: number; src: string }[];
  phrases: { f: number; to: number; words: { w: string; f: number }[] }[];
  /** Each line's text and the frame it starts on, for the script and subtitle files. */
  lines: { f: number; text: string }[];
  /** Number shown in the chapter title (recorded chapters of cuts with chapterTitles). */
  number?: number;
};
/** What the renderer needs from the config: the name and colours, the logo (copied to out/_brand) and links. */
export type Brand = Config['brand'] & { logoFile?: string };
export type RenderPlan = { cut: string; fps: number; frames: number; silent?: boolean; chapterTitles?: boolean; brand: Brand; chapters: ChapterPlan[] };

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

function cursorTrack(events: Timeline['events'], frames: number): number[] {
  const samples = events.filter((e) => e.type === 'move' || e.type === 'down' || e.type === 'up') as { t: number; type: string; x: number; y: number }[];
  const out: number[] = [];
  if (!samples.length) return Array.from({ length: frames * 5 }, () => 0);
  let i = 0;
  let pos = { x: samples[0].x, y: samples[0].y };
  const vel = { x: 0, y: 0 };
  const omega = 30;
  const dt = 1 / FPS;
  let pressed = false;
  let grab = false;
  let lastMove = -Infinity;
  let opacity = 0;
  const drags = events.filter((e) => e.type === 'drag').map((e) => e.t);
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    while (i + 1 < samples.length && samples[i + 1].t <= t) {
      i++;
      const s = samples[i];
      if (s.type === 'down') pressed = true;
      if (s.type === 'up') {
        pressed = false;
        grab = false;
      }
      if (s.type === 'move') lastMove = s.t;
    }
    if (drags.some((d) => d <= t && t - d < 0.05)) grab = true;
    const a = samples[i];
    const b = samples[i + 1];
    let target = { x: a.x, y: a.y };
    if (t < samples[0].t) target = { x: samples[0].x, y: samples[0].y };
    else if (b && b.t - a.t < 0.15) {
      const p = (t - a.t) / (b.t - a.t);
      target = { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    }
    for (const k of ['x', 'y'] as const) {
      vel[k] += (omega * omega * (target[k] - pos[k]) - 2 * omega * vel[k]) * dt;
      pos = { ...pos, [k]: pos[k] + vel[k] * dt };
    }
    // Visible while moving or pressed; fades out after a couple of idle seconds, like Screen Studio.
    const active = t >= samples[0].t - 0.2 && (pressed || t - lastMove < 2.4 || (i === 0 && t < samples[0].t + 2.4));
    opacity = active ? Math.min(1, opacity + dt / 0.15) : Math.max(0, opacity - dt / 0.35);
    out.push(round(pos.x), round(pos.y), round(opacity, 2), pressed ? 1 : 0, grab ? 1 : 0);
  }
  return out;
}

/** For each output frame, the last screenshot taken at or before it. */
function shotIndex(shots: { t: number }[], frames: number): number[] {
  const out: number[] = [];
  let i = 0;
  for (let f = 0; f < frames; f++) {
    while (i + 1 < shots.length && shots[i + 1].t <= f / FPS) i++;
    out.push(i);
  }
  return out;
}

function phrasesOf(captions: Caption[], offset: number, duration: number) {
  const phrases: ChapterPlan['phrases'] = [];
  let words: { w: string; f: number }[] = [];
  let start = 0;
  captions.forEach((c, i) => {
    if (!words.length) start = c.start;
    words.push({ w: c.w, f: Math.round((offset + c.start) * FPS) });
    // Long phrases are split so a caption never runs past about eight words.
    if (c.brk || words.length >= 8 || i === captions.length - 1) {
      const next = captions[i + 1];
      const end = next ? Math.min(next.start, c.end + 0.6) : Math.min(duration, c.end + 0.8);
      phrases.push({ f: Math.round((offset + start) * FPS), to: Math.round((offset + end) * FPS), words });
      words = [];
    }
  });
  return phrases;
}

function loadTimeline(cut: Cut, ci: number, out: string) {
  const dir = path.join(out, cut.id, `ch${String(ci + 1).padStart(2, '0')}`);
  const file = path.join(dir, 'timeline.json');
  if (!existsSync(file)) throw new Error(`Chapter ${ci + 1} (${cut.chapters[ci].title}) is not recorded yet; run npm run record -- ${cut.id}`);
  return { tl: JSON.parse(readFileSync(file, 'utf8')) as Timeline, frames: path.relative(out, path.join(dir, 'frames')).replaceAll('\\', '/') };
}

function sceneChapter(cut: Cut, ci: number, voice: Voice, out: string): ChapterPlan {
  const chapter = cut.chapters[ci];
  const audio: ChapterPlan['audio'] = [];
  const phrases: ChapterPlan['phrases'] = [];
  const words: { w: string; f: number }[] = [];
  const lines: ChapterPlan['lines'] = [];
  let t = SCENE.lead;
  chapter.beats.forEach((b, bi) => {
    const v = voice[beatId(ci, bi)];
    if (!v) throw new Error(`No narration for ${beatId(ci, bi)}; run npm run voice -- ${cut.id}`);
    if (v.file) audio.push({ f: Math.round(t * FPS), src: path.relative(out, v.file).replaceAll('\\', '/') });
    lines.push({ f: Math.round(t * FPS), text: cleanText(b.say ?? '') });
    const p = phrasesOf(v.captions, t, t + v.duration + 1);
    phrases.push(...p);
    words.push(...p.flatMap((x) => x.words));
    t += v.duration + (b.hold ?? SCENE.gap);
  });
  const frames = Math.ceil((t + SCENE.tail) * FPS);
  const plan: ChapterPlan = { title: chapter.title, kind: 'scene', scene: chapter.scene, props: chapter.props, words, dir: '', files: [], shot: [], frames, cam: [], cursor: [], ripples: [], keys: [], callouts: [], audio, phrases, lines };
  if (!chapter.broll) return plan;
  // B-roll is shown whole (no camera moves); the take runs at least as long as the scene, so it is cut to fit.
  const { tl, frames: dir } = loadTimeline(cut, ci, out);
  return {
    ...plan,
    dir,
    files: tl.shots.map((x) => x.file),
    shot: shotIndex(tl.shots, frames),
    cursor: cursorTrack(tl.events, frames),
    ripples: tl.events.filter((e) => e.type === 'down').map((e) => ({ f: Math.round(e.t * FPS), x: e.x!, y: e.y! })),
  };
}

function captureChapter(cut: Cut, ci: number, voice: Voice, out: string): ChapterPlan {
  const chapter = cut.chapters[ci];
  const { tl, frames: dir } = loadTimeline(cut, ci, out);
  const speed = chapter.speed ?? 1;
  const real = Math.ceil(tl.duration * FPS);
  const frames = Math.ceil(real / speed);
  // Tracks are worked out at real time, then every speed-th frame is kept.
  const pick = <T>(list: T[], width: number) => Array.from({ length: frames }, (_, f) => list.slice(Math.min(real - 1, f * speed) * width, Math.min(real - 1, f * speed) * width + width)).flat();
  // A sped-up chapter holds the wide shot: zooming on every click at 5× reads as jitter.
  const track = speed > 1 ? Array.from({ length: real }, () => WIDE) : cameraTrack(tl.events, tl.duration);
  const cam = pick(track.flatMap((k) => [round(k.s, 4), round(k.x), round(k.y)]), 3);
  const cursor = pick(cursorTrack(tl.events, real), 5);
  const shot = pick(shotIndex(tl.shots, real), 1);
  const F = (t: number) => Math.round((t * FPS) / speed);
  const beats = tl.events.filter((e) => e.type === 'beat');
  const audio: ChapterPlan['audio'] = [];
  const phrases: ChapterPlan['phrases'] = [];
  const said = chapter.voiceover
    ? [{ id: voiceoverId(ci), t: 0.3, say: chapter.voiceover }]
    : beats.map((b) => ({ id: b.id!, t: b.t, say: chapter.beats[Number(b.id!.slice(-3)) - 1]?.say ?? '' }));
  const lines: ChapterPlan['lines'] = [];
  for (const line of said) {
    const v = voice[line.id];
    if (!v) continue;
    lines.push({ f: F(line.t), text: cleanText(line.say) });
    if (v.file) audio.push({ f: Math.round(line.t * FPS), src: path.relative(out, v.file).replaceAll('\\', '/') });
    phrases.push(...phrasesOf(v.captions, line.t, frames / FPS));
  }
  const callouts = tl.events
    .filter((e) => e.type === 'callout')
    .map((e) => {
      const nextBeat = beats.find((b) => b.t > e.t);
      return { f: F(e.t), to: F(nextBeat ? nextBeat.t : tl.duration), box: e.box!, text: e.text! };
    });
  return {
    title: tl.title,
    kind: 'capture',
    speed: chapter.speed,
    dir,
    files: tl.shots.map((x) => x.file),
    shot,
    frames,
    cam,
    cursor,
    ripples: tl.events.filter((e) => e.type === 'down').map((e) => ({ f: F(e.t), x: e.x!, y: e.y! })),
    keys: tl.events.filter((e) => e.type === 'keys').map((e) => ({ f: F(e.t), keys: e.keys! })),
    callouts,
    audio,
    phrases,
    lines,
  };
}

/** A silent cut's stand-in for the voice stage: each line lasts its reading time, with estimated word timings. */
function silentVoice(cut: Cut): Voice {
  const voice: Voice = {};
  const add = (id: string, say: string) => {
    const duration = readSeconds(say);
    voice[id] = { file: '', duration, captions: estimateCaptions(say, duration) };
  };
  cut.chapters.forEach((c, ci) => {
    if (c.voiceover) add(voiceoverId(ci), c.voiceover);
    c.beats.forEach((b, bi) => b.say && add(beatId(ci, bi), b.say));
  });
  return voice;
}

export function planCut(cut: Cut, brand: Brand): RenderPlan {
  const out = OUT;
  const voiceFile = path.join(out, cut.id, 'voice', 'voice.json');
  const voice: Voice = cut.silent ? silentVoice(cut) : existsSync(voiceFile) ? JSON.parse(readFileSync(voiceFile, 'utf8')) : {};
  const chapters = cut.chapters.map((c, ci) => (c.kind === 'scene' ? sceneChapter(cut, ci, voice, out) : captureChapter(cut, ci, voice, out)));
  if (cut.chapterTitles) chapters.filter((c) => c.kind === 'capture').forEach((c, i) => (c.number = i + 1));
  return { cut: cut.id, fps: FPS, frames: chapters.reduce((n, c) => n + c.frames, 0), silent: cut.silent, chapterTitles: cut.chapterTitles, brand, chapters };
}

export function writePlan(cut: Cut, brand: Brand): string {
  const file = path.join(OUT, cut.id, 'render.json');
  writeFileSync(file, JSON.stringify(planCut(cut, brand)));
  return file;
}
