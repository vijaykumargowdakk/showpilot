// Text for silent cuts and subtitle files. A silent cut has no narration, so word timings are estimated from the
// text: each word gets time by its length, and the delivery marks (| breath, || beat, [pause N]) become breaks.
// The result has the same shape as the voice stage's captions, so scenes and subtitles work the same either way.

export type Caption = { w: string; start: number; end: number; brk: boolean };

/** A line as it reads on screen: delivery markup removed, emphasis kept as plain words. */
export function cleanText(say: string): string {
  return say
    .replace(/<\/?\w+>/g, '')
    .replace(/\[pause [\d.]+\]/g, ' ')
    .replace(/\|+/g, ' ')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word timings for a line shown for `duration` seconds, with a break after every `|`, `||`, pause or sentence end. */
export function estimateCaptions(say: string, duration: number): Caption[] {
  const tokens = say
    .replace(/<\/?\w+>/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[pause ([\d.]+)\]/g, ' [pause:$1] ')
    .replace(/\|\|/g, ' [pause:0.55] ')
    .replace(/\|/g, ' [pause:0.2] ')
    .split(/\s+/)
    .filter(Boolean);
  const items: ({ w: string; weight: number } | { pause: number })[] = tokens.map((t) => {
    const m = /^\[pause:([\d.]+)\]$/.exec(t);
    return m ? { pause: Number(m[1]) } : { w: t, weight: 0.25 + 0.055 * t.length };
  });
  const total = items.reduce((n, x) => n + ('pause' in x ? x.pause : x.weight), 0) || 1;
  const k = duration / total;
  const out: Caption[] = [];
  let t = 0;
  for (const x of items) {
    if ('pause' in x) {
      if (out.length) out[out.length - 1].brk = true;
      t += x.pause * k;
      continue;
    }
    out.push({ w: x.w, start: round(t), end: round(t + x.weight * k), brk: /[.!?:;]$/.test(x.w) });
    t += x.weight * k;
  }
  if (out.length) out[out.length - 1].brk = true;
  return out;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** SubRip time stamp, e.g. 00:01:02,345. */
export function srtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/** Breaks a cue into at most two lines of about `width` characters, at the space nearest the middle. */
export function wrapCue(text: string, width = 42): string {
  if (text.length <= width) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = text.indexOf(' '); i !== -1; i = text.indexOf(' ', i + 1)) if (best === -1 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
  return best === -1 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
}

export type Cue = { start: number; end: number; text: string };

/** A SubRip file: cues in order, never overlapping, each shown for at least `min` seconds where there is room. */
export function toSrt(cues: Cue[], min = 1.2): string {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  return sorted
    .map((c, i) => {
      const next = sorted[i + 1]?.start ?? Infinity;
      const end = Math.min(Math.max(c.end, c.start + min), next);
      return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(end)}\n${wrapCue(c.text)}\n`;
    })
    .join('\n');
}
