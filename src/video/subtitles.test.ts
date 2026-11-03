import { describe, expect, it } from 'vitest';
import { cleanText, estimateCaptions, srtTime, toSrt, wrapCue } from './subtitles';

describe('silent captions', () => {
  it('reads without delivery markup', () => {
    expect(cleanText('This is *Showpilot*. | It films <slow>your app</slow>. || [pause 0.4] Live!')).toBe('This is Showpilot. It films your app. Live!');
  });

  it('spreads the words over the whole line, in order, with breaks at marks and sentence ends', () => {
    const c = estimateCaptions('Click any device, | and everything is here. || Its kind.', 6);
    expect(c.map((x) => x.w)).toEqual(['Click', 'any', 'device,', 'and', 'everything', 'is', 'here.', 'Its', 'kind.']);
    expect(c[0].start).toBe(0);
    expect(c.at(-1)!.end).toBeCloseTo(6, 2);
    for (let i = 1; i < c.length; i++) expect(c[i].start).toBeGreaterThanOrEqual(c[i - 1].end - 0.001);
    expect(c.filter((x) => x.brk).map((x) => x.w)).toEqual(['device,', 'here.', 'kind.']);
  });

  it('gives longer words more time', () => {
    const [a, b] = estimateCaptions('a extraordinarily', 3);
    expect(b.end - b.start).toBeGreaterThan(a.end - a.start);
  });
});

describe('SubRip', () => {
  it('formats time stamps', () => {
    expect(srtTime(0)).toBe('00:00:00,000');
    expect(srtTime(3723.4567)).toBe('01:02:03,457');
  });

  it('wraps long cues onto two lines near the middle', () => {
    expect(wrapCue('Short one')).toBe('Short one');
    const w = wrapCue('Every connection carries a real industrial protocol, with its settings');
    expect(w.split('\n')).toHaveLength(2);
    expect(Math.abs(w.split('\n')[0].length - w.split('\n')[1].length)).toBeLessThan(12);
  });

  it('numbers cues in order, keeps a minimum length, and never overlaps the next cue', () => {
    const srt = toSrt([
      { start: 5, end: 5.3, text: 'second' },
      { start: 1, end: 6, text: 'first' },
    ]);
    expect(srt).toBe('1\n00:00:01,000 --> 00:00:05,000\nfirst\n\n2\n00:00:05,000 --> 00:00:06,200\nsecond\n');
  });
});
