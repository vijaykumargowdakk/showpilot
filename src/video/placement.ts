// Laying narration over a finished silent render: where each line belongs, how to fit a clip into its slot, the
// subtitles that follow the voice, and (for your own recorded voice) which part of a take is which line.
// Pure functions, shared by `showpilot dub` (generated narration) and `showpilot align` (your own recording).
import type { Cut } from '../recorder/script';
import { beatId } from '../recorder/script';
import type { RenderPlan } from './plan';
import { cleanText, type Caption, type Cue } from './subtitles';

export type Slot = { id: string; say: string; start: number; slot: number };

/** Every line of a silent cut, with the time it appears in the rendered video and how long until the next one. */
export function lineSlots(cut: Cut, plan: RenderPlan): Slot[] {
  const slots: Slot[] = [];
  let offset = 0;
  plan.chapters.forEach((ch, ci) => {
    const beats = cut.chapters[ci].beats.flatMap((b, bi) => (b.say ? [{ id: beatId(ci, bi), say: b.say }] : []));
    if (beats.length !== ch.lines.length) throw new Error(`Chapter ${ci + 1}: ${beats.length} lines in the cut, ${ch.lines.length} in the plan`);
    ch.lines.forEach((line, k) => {
      const start = (offset + line.f) / plan.fps;
      const next = (offset + (ch.lines[k + 1]?.f ?? ch.frames)) / plan.fps;
      slots.push({ ...beats[k], start, slot: next - start });
    });
    offset += ch.frames;
  });
  return slots;
}

export const GAP = 0.25;
export const MAX_TEMPO = 1.12;

export type Timed<T> = T & { tempo: number; at: number; end: number };

/**
 * Spoken lines can run longer than the slot they were paced for. Such a line is sped up a little (at most 12%, pitch
 * kept by the mixer), and if it still runs over, the next line waits for it, so no two lines ever overlap.
 */
export function fit<T extends { start: number; slot: number; duration: number }>(clips: T[]): Timed<T>[] {
  let end = -Infinity;
  return clips.map((c) => {
    const tempo = Math.min(MAX_TEMPO, Math.max(1, c.duration / Math.max(0.5, c.slot - GAP)));
    const at = Math.max(c.start, end + GAP);
    end = at + c.duration / tempo;
    return { ...c, tempo, at, end };
  });
}

/** Subtitles that follow the voice, with the voiced cuts' phrase breaks (a break mark or sentence end, or eight words). */
export function voicedCues(timed: Timed<{ captions: Caption[] }>[]): Cue[] {
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
  return cues;
}

export type Span = { start: number; end: number };

/**
 * Which stretch of a self-read take is which line, from the take's speech segments (found by silence detection).
 * People reading along start each line a little after it appears, so each line takes the speech onset nearest to
 * about 0.4 s after its start, within a window, after the previous line's. A line ends where the next one begins,
 * trimmed to the end of its last speech.
 */
export function mapBySilence(slots: { start: number; slot: number }[], speech: Span[]): (Span | null)[] {
  const onsets = speech.map((s) => s.start);
  const picked: (number | null)[] = [];
  let after = -Infinity;
  for (const s of slots) {
    const target = s.start + 0.4;
    const inWindow = onsets.filter((o) => o >= after + 0.3 && o >= s.start - 1.5 && o <= s.start + Math.max(3, Math.min(6, s.slot)));
    const o = inWindow.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0] ?? null;
    picked.push(o);
    if (o !== null) after = o;
  }
  return spansFrom(picked, speech);
}

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * The same with a transcript: each line starts at the transcript word where its first words are said, searched in
 * order (so a repeated phrase is matched to the right line), and ends just after the last word before the next line.
 */
export function mapByWords(lines: string[], words: { w: string; start: number; end: number }[]): (Span | null)[] {
  const said = words.map((w) => norm(w.w));
  const picked: (number | null)[] = [];
  let from = 0;
  for (const line of lines) {
    const head = cleanText(line).split(/\s+/).map(norm).filter(Boolean).slice(0, 3);
    let best = -1;
    let score = 0;
    for (let i = from; i < Math.min(said.length, from + 80); i++) {
      const s = head.reduce((n, w, k) => n + (said[i + k] === w ? 1 : 0), 0);
      if (s > score) [best, score] = [i, s];
      if (s === head.length) break;
    }
    if (best === -1 || score < Math.min(2, head.length)) picked.push(null);
    else {
      picked.push(words[best].start);
      from = best + 1;
    }
  }
  return spansFrom(picked, words.map((w) => ({ start: w.start, end: w.end })));
}

/**
 * A transcript says which words are which line, but its word times can be off by a few tenths of a second; silence
 * detection knows exactly where speech starts. Each line's start moves to the speech onset within 0.7 s of it.
 */
export function snapToSpeech(spans: (Span | null)[], speech: Span[]): (Span | null)[] {
  return spans.map((span) => {
    if (!span) return null;
    const onset = speech.map((s) => s.start).sort((a, b) => Math.abs(a - span.start) - Math.abs(b - span.start))[0];
    return onset !== undefined && Math.abs(onset - span.start) <= 0.7 && onset < span.end - 0.2 ? { start: ms(Math.max(0, onset - 0.05)), end: span.end } : span;
  });
}

function spansFrom(starts: (number | null)[], speech: Span[]): (Span | null)[] {
  return starts.map((start, i) => {
    if (start === null) return null;
    const next = starts.slice(i + 1).find((s): s is number => s !== null) ?? Infinity;
    const lastSpeech = speech.filter((s) => s.start >= start - 0.01 && s.start < next).at(-1);
    return { start: ms(Math.max(0, start - 0.08)), end: ms(Math.min(next - 0.05, (lastSpeech?.end ?? start + 1) + 0.15)) };
  });
}

const ms = (s: number) => Math.round(s * 1000) / 1000;
