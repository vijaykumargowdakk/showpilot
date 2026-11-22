import { describe, expect, it } from 'vitest';
import { ALONE, BED, BRIDGE, DUCK, duckExpr, mergeSpans, musicChain, narrationSpans } from './music';
import type { RenderPlan } from './plan';

// Evaluates an ffmpeg volume expression the way ffmpeg does, for the functions duckExpr uses.
const gain = (expr: string, t: number) =>
  new Function('t', 'clip', 'max', `return ${expr};`)(t, (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x)), Math.max) as number;
const dipped = 10 ** (DUCK.depth / 20);

describe('where the narration plays', () => {
  it('offsets each clip by the chapters before it', () => {
    const plan = {
      fps: 60,
      chapters: [
        { frames: 600, audio: [{ f: 60, src: 'a.wav', d: 2 }] },
        { frames: 300, audio: [{ f: 0, src: 'b.wav', d: 1.5 }, { f: 180, src: 'c.wav', d: 1 }] },
      ],
    } as unknown as RenderPlan;
    expect(narrationSpans(plan)).toEqual([
      { start: 1, end: 3 },
      { start: 10, end: 11.5 },
      { start: 13, end: 14 },
    ]);
  });

  it('joins lines that are close together, so the music stays down between them', () => {
    expect(mergeSpans([{ start: 5, end: 6 }, { start: 0, end: 2 }, { start: 2 + BRIDGE - 0.1, end: 4 }])).toEqual([
      { start: 0, end: 6 },
    ]);
    expect(mergeSpans([{ start: 0, end: 2 }, { start: 2 + BRIDGE + 0.1, end: 5 }])).toHaveLength(2);
  });
});

describe('ducking', () => {
  const expr = duckExpr([{ start: 10, end: 14 }, { start: 30, end: 31 }]);

  it('is full volume between lines and dips under them', () => {
    expect(gain(expr, 0)).toBe(1);
    expect(gain(expr, 20)).toBe(1);
    for (const t of [10, 12, 14, 30, 31]) expect(gain(expr, t)).toBeCloseTo(dipped, 4);
  });

  it('ramps down before a line and back up after it', () => {
    expect(gain(expr, 10 - DUCK.attack)).toBe(1);
    expect(gain(expr, 10 - DUCK.attack / 2)).toBeCloseTo((1 + dipped) / 2, 4);
    expect(gain(expr, 14 + DUCK.release / 2)).toBeCloseTo((1 + dipped) / 2, 4);
    expect(gain(expr, 14 + DUCK.release)).toBe(1);
  });

  it('handles a line at the very start, and no lines at all', () => {
    expect(gain(duckExpr([{ start: 0, end: 2 }]), 0)).toBeCloseTo(dipped, 4);
    expect(duckExpr([])).toBe('1');
  });
});

describe('the music filter chain', () => {
  it('sits under the narration, or carries the video alone', () => {
    expect(musicChain(1, 60, [{ start: 5, end: 8 }])).toContain(`loudnorm=I=${BED}:`);
    expect(musicChain(1, 60, [])).toContain(`loudnorm=I=${ALONE}:`);
    expect(musicChain(1, 60, [], -3)).toContain(`loudnorm=I=${ALONE - 3}:`);
  });

  it('is trimmed to the video and fades out at its end', () => {
    const chain = musicChain(2, 40, []);
    expect(chain.startsWith('[2:a]atrim=0:40.000,')).toBe(true);
    expect(chain).toContain('afade=t=out:st=37.000:d=3.000[music]');
    expect(musicChain(1, 6, [])).toContain('afade=t=out:st=4.000:d=2.000');
  });
});
