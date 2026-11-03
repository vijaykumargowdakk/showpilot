import { describe, expect, it } from 'vitest';
import { fit, GAP, MAX_TEMPO, mapBySilence, mapByWords, voicedCues } from './placement';

describe('fitting narration into its slots', () => {
  it('leaves lines that fit alone, speeds up long ones a little, and never overlaps', () => {
    const timed = fit([
      { start: 0, slot: 4, duration: 3 },
      { start: 4, slot: 3, duration: 4.5 },
      { start: 7, slot: 5, duration: 2 },
    ]);
    expect(timed[0]).toMatchObject({ tempo: 1, at: 0 });
    expect(timed[1].tempo).toBe(MAX_TEMPO);
    expect(timed[2].at).toBeCloseTo(timed[1].end + GAP, 5);
    for (let i = 1; i < timed.length; i++) expect(timed[i].at).toBeGreaterThanOrEqual(timed[i - 1].end + GAP - 1e-9);
  });

  it('times the subtitles to the voice, including the speed-up', () => {
    const [c] = fit([{ start: 10, slot: 1, duration: 2, captions: [{ w: 'Hello', start: 0, end: 0.5, brk: false }, { w: 'there.', start: 0.6, end: 1, brk: true }] }]);
    const [cue] = voicedCues([c]);
    expect(cue.text).toBe('Hello there.');
    expect(cue.start).toBe(10);
    expect(cue.end).toBeCloseTo(10 + 1 / c.tempo + 0.8, 5);
  });
});

describe('finding each line in your own recording', () => {
  const slots = [
    { start: 1, slot: 5 },
    { start: 6, slot: 4 },
    { start: 10, slot: 5 },
  ];

  it('maps speech onsets to lines, ignoring pauses inside a line', () => {
    const speech = [
      { start: 1.5, end: 3 },
      { start: 3.4, end: 5.2 }, // a pause inside line 1
      { start: 6.3, end: 9 },
      { start: 10.6, end: 13 },
    ];
    expect(mapBySilence(slots, speech)).toEqual([
      { start: 1.42, end: 5.35 },
      { start: 6.22, end: 9.15 },
      { start: 10.52, end: 13.15 },
    ]);
  });

  it('leaves a line out when nothing was said near it', () => {
    const spans = mapBySilence(slots, [
      { start: 1.4, end: 4 },
      { start: 10.5, end: 12 },
    ]);
    expect(spans[1]).toBeNull();
    expect(spans[0]!.end).toBeLessThan(10.5);
  });

  it('uses a transcript when there is one, in order, so repeated words go to the right line', () => {
    const t = (w: string, start: number) => ({ w, start, end: start + 0.3 });
    const words = [t('Meet', 1), t('Taskly.', 1.4), t('Type', 6.2), t('what', 6.6), t('needs', 7), t('doing.', 7.4), t('Meet', 10.4), t('the', 10.8), t('team.', 11.2)];
    expect(mapByWords(['Meet *Taskly*.', 'Type what needs doing, | and press Enter.', 'Meet the team.'], words).map((s) => s?.start)).toEqual([0.92, 6.12, 10.32]);
  });
});
