import { describe, expect, it } from 'vitest';
import { cameraTrack, type TimelineEvent } from './camera';
import { clampCam, geometryFor, LAYOUTS, toStage } from './geometry';

const click = (t: number, x: number, y: number): TimelineEvent => ({ t, type: 'click', x, y, box: { x: x - 40, y: y - 15, width: 80, height: 30 } });

describe('layouts', () => {
  it('keep landscape exactly as it was', () => {
    const g = geometryFor('landscape');
    expect(g.OUT).toEqual({ w: 1920, h: 1080 });
    expect(g.VIEW).toEqual({ w: 1920, h: 1080 });
    expect(g.WIN).toEqual({ w: 1600, h: 900, titlebar: 40 });
    expect(g.CAPTURE.scale).toBe(1);
  });

  it('fit the window inside the frame, centred across it', () => {
    for (const layout of LAYOUTS) {
      const g = geometryFor(layout);
      expect(g.WIN_X).toBeGreaterThanOrEqual(0);
      expect(g.WIN_X * 2 + g.WIN.w).toBeCloseTo(g.OUT.w, 6);
      expect(g.CONTENT_Y + g.WIN.h).toBeLessThanOrEqual(g.OUT.h);
      expect(toStage(g, g.VIEW.w, g.VIEW.h)).toEqual({ x: g.WIN_X + g.WIN.w, y: g.CONTENT_Y + g.WIN.h });
    }
  });

  it('give the phone frame a portrait video with room for captions under the phone', () => {
    const g = geometryFor('vertical-phone');
    expect(g.OUT).toEqual({ w: 1080, h: 1920 });
    expect(g.VIEW.w).toBeLessThan(600);
    expect(g.OUT.h - (g.CONTENT_Y + g.WIN.h)).toBeGreaterThanOrEqual(200);
    expect(g.CAPTURE.scale).toBeGreaterThanOrEqual(g.K * g.ZOOM.max);
  });

  it('keep the camera inside the window and within the layout zoom range', () => {
    for (const layout of LAYOUTS) {
      const g = geometryFor(layout);
      const track = cameraTrack([click(1, 20, 20), click(4, g.VIEW.w - 20, g.VIEW.h - 20)], 12, g);
      for (const c of track) {
        expect(c.s).toBeLessThanOrEqual(g.ZOOM.max + 1e-9);
        expect(clampCam(c, g)).toEqual(c);
      }
      const end = track.at(-1)!;
      for (const k of ['s', 'x', 'y'] as const) expect(end[k]).toBeCloseTo(g.WIDE[k], 2);
    }
  });
});
