import { describe, expect, it } from 'vitest';
import { cameraTrack, shots, targetAt, ZOOM, type TimelineEvent } from './camera';
import { clampCam, WIDE } from './geometry';

const click = (t: number, x: number, y: number, w = 120, h = 40): TimelineEvent => ({ t, type: 'click', x, y, box: { x: x - w / 2, y: y - h / 2, width: w, height: h } });

describe('shots', () => {
  it('groups clicks close in time and space into one shot', () => {
    const s = shots([click(1, 500, 400), click(1.8, 600, 420)]);
    expect(s).toHaveLength(1);
    expect(s[0].from).toBeCloseTo(0.55);
    expect(s[0].to).toBeCloseTo(3.3);
  });

  it('starts a new shot after a pause or when the next click is far away', () => {
    expect(shots([click(1, 500, 400), click(5, 520, 410)])).toHaveLength(2);
    expect(shots([click(1, 100, 100), click(1.5, 1800, 1000)])).toHaveLength(2);
  });

  it('ignores clicks inside a wide beat but keeps explicit focus', () => {
    const events: TimelineEvent[] = [{ t: 0, type: 'beat' }, { t: 0, type: 'wide' }, click(1, 500, 400), { t: 2, type: 'focus', box: { x: 100, y: 100, width: 300, height: 200 } }];
    const s = shots(events);
    expect(s).toHaveLength(1);
    expect(s[0].cam.s).toBe(ZOOM.focus);
  });

  it('keeps zoom within limits', () => {
    for (const s of shots([click(1, 900, 500, 10, 10), click(9, 900, 500, 1500, 380)])) {
      expect(s.cam.s).toBeGreaterThanOrEqual(ZOOM.min);
      expect(s.cam.s).toBeLessThanOrEqual(ZOOM.max);
    }
  });
});

describe('camera', () => {
  it('is wide with no actions', () => {
    expect(targetAt([], 3)).toEqual(WIDE);
    const track = cameraTrack([], 2);
    expect(track).toHaveLength(120);
    expect(track.at(-1)).toEqual(WIDE);
  });

  it('never leaves the window when zoomed on a corner', () => {
    const c = clampCam({ s: 2.2, x: 0, y: 0 });
    expect(c.x).toBeGreaterThan(0);
    expect(c.y).toBeGreaterThan(-48);
  });

  it('moves smoothly: no frame-to-frame jump bigger than a fling', () => {
    const track = cameraTrack([click(1, 300, 200), click(4, 1600, 900)], 7);
    for (let i = 1; i < track.length; i++) {
      expect(Math.abs(track[i].x - track[i - 1].x)).toBeLessThan(40);
      expect(Math.abs(Math.log(track[i].s / track[i - 1].s))).toBeLessThan(0.05);
    }
  });

  it('zooms in on the action and back out afterwards', () => {
    const track = cameraTrack([click(1, 500, 400)], 6);
    expect(track[Math.round(2 * 60)].s).toBeGreaterThan(1.4);
    expect(track.at(-1)!.s).toBeLessThan(1.05);
  });
});
