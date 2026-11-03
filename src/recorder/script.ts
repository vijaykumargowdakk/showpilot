// The shape of a video script: a cut is chapters, a chapter is beats. Each beat has a line of narration
// (marked up for delivery, see voice/delivery.py) and the actions shown while it is spoken.
import type { Studio } from './studio';

export type Box = { x: number; y: number; width: number; height: number };

/** Where the camera looks during a beat. 'auto' follows clicks; 'wide' shows the whole window. */
export type Camera = 'auto' | 'wide' | { focus: Box | ((s: Studio) => Promise<Box>); scale?: number };

export type Beat = {
  say?: string;
  /** What the narrator says, when it differs from the on-screen text: a silent cut's lines are written to be read,
   *  and are dubbed later with lines written to be spoken. Timing still comes from `say`. */
  speak?: string;
  do?: (s: Studio) => Promise<void>;
  camera?: Camera;
  /** Extra seconds held after the narration ends (default 0.35). */
  hold?: number;
  /** Seconds to wait after the line starts before acting, so the eye follows the voice (default 0.3). */
  lead?: number;
};

/** Scenes are drawn by the renderer, not recorded: big kinetic text, badges that appear as they are named, the closing card. */
export type SceneKind = 'kinetic' | 'badges' | 'cta';

/** What a scene draws besides the narration. Words are matched case-insensitively against the spoken words. */
export type SceneProps = {
  /** kinetic: words drawn in the accent colour, e.g. ['secure', 'offline']. */
  highlight?: string[];
  /** badges: one card per item, appearing when `word` is said, under the name and logo. */
  badges?: { word: string; title: string; sub?: string }[];
  /** badges: a line shown once `after` is said, e.g. { text: 'No server · Works offline', after: 'server' }. */
  tagline?: { text: string; after: string };
  /** cta: the line under the name on the closing card (the links come from brand.links). */
  line?: string;
};

export type Chapter = {
  title: string;
  /** 'app' records the configured app (default), 'web' records another site from `url`, 'scene' is drawn by the renderer. */
  kind?: 'app' | 'web' | 'scene';
  url?: string;
  scene?: SceneKind;
  props?: SceneProps;
  /** Plays the recording this many times faster, with a timer; its beats are acted, not narrated. */
  speed?: number;
  /** Narration laid over a sped-up chapter from its start. */
  voiceover?: string;
  /** Called once before recording starts (open the app, load a template). Not shown in the video. */
  setup?: (s: Studio) => Promise<void>;
  /** App footage played behind a scene: these actions are recorded, unnarrated, for as long as the scene lasts. */
  broll?: (s: Studio) => Promise<void>;
  /** Lets the app's service worker run, so its offline notices can be shown (recordings block it otherwise). */
  offline?: boolean;
  beats: Beat[];
};

/** Timing of a scene chapter, in seconds: a lead-in, each line followed by its hold (default gap), and a tail. */
export const SCENE = { lead: 0.5, gap: 0.45, tail: 0.8 };

/** How long a scene chapter runs, given the spoken length of each beat's line. */
export const sceneSeconds = (beats: Beat[], spoken: (beatIndex: number) => number) =>
  SCENE.lead + beats.reduce((t, b, i) => t + spoken(i) + (b.hold ?? SCENE.gap), 0) + SCENE.tail;

export type Cut = {
  id: string;
  title: string;
  chapters: Chapter[];
  /** No voice: each line is shown for as long as it takes to read, and its text goes to an .srt file instead. */
  silent?: boolean;
  /** Shows a numbered title at the top of each recorded chapter (for long cuts). */
  chapterTitles?: boolean;
  /** `showpilot thumbnail`: a recorded screenshot (chapter number from 1, seconds into its take, crop in app pixels)
   *  beside a short headline; one image per headline. Lines from `accentFrom` on are drawn in the accent colour. */
  thumbnail?: { chapter: number; at: number; crop: Box; headlines: { lines: string[]; accentFrom?: number }[]; chips?: string[] };
};

export const cut = (c: Cut): Cut => c;
export const chapter = (title: string, beats: Beat[], setup?: Chapter['setup'], extra?: Pick<Chapter, 'offline'>): Chapter => ({ title, beats, setup, ...extra });
export const scene = (title: string, kind: SceneKind, beats: Beat[], extra?: Pick<Chapter, 'setup' | 'broll' | 'props'>): Chapter => ({ title, kind: 'scene', scene: kind, beats, ...extra });
export const web = (title: string, url: string, beats: Beat[], setup?: Chapter['setup']): Chapter => ({ title, kind: 'web', url, beats, setup });
export const beat = (b: Beat): Beat => b;

/** Stable id of a beat, used to match narration audio to the recording. */
export const beatId = (chapterIndex: number, beatIndex: number) => `c${String(chapterIndex + 1).padStart(2, '0')}b${String(beatIndex + 1).padStart(3, '0')}`;
export const voiceoverId = (chapterIndex: number) => `c${String(chapterIndex + 1).padStart(2, '0')}vo`;

/** Every narrated line of a cut, in order: beat lines, plus the voiceover of sped-up chapters. */
export function narratedLines(cut: Cut): { id: string; say: string }[] {
  return cut.chapters.flatMap((c, ci) => [
    ...(c.voiceover ? [{ id: voiceoverId(ci), say: c.voiceover }] : []),
    ...(c.speed ? [] : c.beats.flatMap((b, bi) => (b.say ? [{ id: beatId(ci, bi), say: b.speak ?? b.say }] : []))),
  ]);
}

/** Rough narration length before the voice stage has run (2.5 words a second plus pauses). */
export function estimateSeconds(say: string): number {
  const words = say.replace(/\[pause [\d.]+\]|\||\*|<\/?\w+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const pauses = [...say.matchAll(/\[pause ([\d.]+)\]/g)].reduce((t, m) => t + Number(m[1]), 0);
  return words / 2.5 + pauses + (say.match(/\|\|/g)?.length ?? 0) * 0.55 + (say.match(/(?<!\|)\|(?!\|)/g)?.length ?? 0) * 0.2;
}

/** How long a line stays up in a silent cut: comfortable reading (2.2 words a second), never under 3 s. */
export function readSeconds(say: string): number {
  const words = say.replace(/\[pause [\d.]+\]|\||\*|<\/?\w+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const pauses = [...say.matchAll(/\[pause ([\d.]+)\]/g)].reduce((t, m) => t + Number(m[1]), 0);
  return Math.max(3, words / 2.2 + pauses + (say.match(/\|\|/g)?.length ?? 0) * 0.55);
}

/** The length of a line before (or without) narration: reading time in silent cuts, speaking time otherwise. */
export const lineSeconds = (cut: Cut, say: string) => (cut.silent ? readSeconds(say) : estimateSeconds(say));
