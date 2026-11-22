// Background music under a video: its level, the dips while the narrator speaks, and the fades at both ends.
// Pure functions that build an ffmpeg filter chain, shared by `render` (narration rendered by Remotion) and by
// `dub` and `align` (narration laid over a silent render).
import type { Span } from './placement';
import type { RenderPlan } from './plan';

/** Loudness of the music (LUFS): under the narration's -16 between lines, or the whole soundtrack with no narration. */
export const BED = -24;
export const ALONE = -16;
/** How far the music dips under a line (dB), and how long it takes to go down before the line and back up after it. */
export const DUCK = { depth: -12, attack: 0.3, release: 0.8 };
/** Lines closer together than this share one dip, so the music doesn't pump between sentences. */
export const BRIDGE = 1.5;
export const FADE = { in: 1.5, out: 3 };

/** Where the narration plays in a rendered video, in seconds: each clip's frame, offset by the chapters before it. */
export function narrationSpans(plan: RenderPlan): Span[] {
  const spans: Span[] = [];
  let offset = 0;
  for (const ch of plan.chapters) {
    for (const a of ch.audio) {
      const start = (offset + a.f) / plan.fps;
      spans.push({ start, end: start + a.d });
    }
    offset += ch.frames;
  }
  return spans;
}

/** Spans in order, with any that overlap or come within `bridge` seconds of each other joined into one. */
export function mergeSpans(spans: Span[], bridge = BRIDGE): Span[] {
  const merged: Span[] = [];
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && s.start - last.end < bridge) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/**
 * The music's gain as an ffmpeg expression in `t`: 1 between lines and DUCK.depth under them, ramping down so the
 * dip is complete as a line starts, and back up after it ends.
 */
export function duckExpr(spans: Span[]): string {
  if (!spans.length) return '1';
  const n = (x: number) => `(${x.toFixed(3)})`;
  const dip = (1 - 10 ** (DUCK.depth / 20)).toFixed(4);
  const under = mergeSpans(spans).map(
    ({ start, end }) => `clip((t-${n(start - DUCK.attack)})/${DUCK.attack},0,1)*clip((${n(end + DUCK.release)}-t)/${DUCK.release},0,1)`,
  );
  return `1-${dip}*${under.reduce((a, b) => `max(${a},${b})`)}`;
}

/**
 * Filter lines that turn audio input `input` (the music, looped) into `[music]`: `seconds` long, normalised to the
 * bed level (or to ALONE when nothing is spoken), dipping under `spans`, faded in and out. `volume` shifts it in dB.
 */
export function musicChain(input: number, seconds: number, spans: Span[], volume = 0): string {
  const level = (spans.length ? BED : ALONE) + volume;
  const out = Math.min(FADE.out, seconds / 3);
  return [
    `[${input}:a]atrim=0:${seconds.toFixed(3)},asetpts=PTS-STARTPTS`,
    `loudnorm=I=${level}:TP=-2:LRA=11,aresample=48000,aformat=channel_layouts=stereo`,
    `volume='${duckExpr(spans)}':eval=frame`,
    `afade=t=in:d=${FADE.in},afade=t=out:st=${(seconds - out).toFixed(3)}:d=${out.toFixed(3)}[music]`,
  ].join(',');
}
