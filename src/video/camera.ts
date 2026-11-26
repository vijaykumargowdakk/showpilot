// Screen Studio-style automatic camera: zooms in on where the action is, holds while it continues, pans between
// nearby actions, and eases back out when things go quiet. Pure functions, so they can be unit-tested.
import { clampCam, FPS, LANDSCAPE, type Cam, type Geometry } from './geometry';

type Box = { x: number; y: number; width: number; height: number };
export type TimelineEvent = { t: number; type: string; x?: number; y?: number; box?: Box; from?: Box; scale?: number };

/** The landscape zoom range; each layout has its own (`Geometry.ZOOM`). */
export const ZOOM = LANDSCAPE.ZOOM;
const GROUP_GAP = 1.6; // seconds between actions that still count as one shot
const LEAD = 0.45; // start moving this long before the first action
const HOLD = 1.5; // stay this long after the last action
const PAD = 140; // app pixels around the action

type Interest = { t: number; box: Box; scale?: number };
export type Shot = { from: number; to: number; cam: Cam };

const pointBox = (x: number, y: number): Box => ({ x: x - 1, y: y - 1, width: 2, height: 2 });
function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}
/** Elements wider than this are framed around the click point instead (a whole panel would zoom too little). */
const limit = (b: Box, x: number, y: number): Box => (b.width > 700 || b.height > 400 ? pointBox(x, y) : b);

/** The things worth looking at, ignoring automatic actions inside a beat marked 'wide'. */
export function interests(events: TimelineEvent[], g: Geometry = LANDSCAPE): Interest[] {
  const out: Interest[] = [];
  let wide = false;
  for (const e of events) {
    if (e.type === 'beat') wide = false;
    if (e.type === 'wide') wide = true;
    if (e.type === 'focus' && e.box) out.push({ t: e.t, box: e.box, scale: e.scale ?? g.ZOOM.focus });
    if (wide) continue;
    if (e.type === 'click' && e.box) out.push({ t: e.t, box: limit(e.box, e.x!, e.y!) });
    if (e.type === 'type' && e.box) out.push({ t: e.t, box: e.box });
    if (e.type === 'drag' && e.from) out.push({ t: e.t, box: union(e.from, pointBox(e.x!, e.y!)) });
  }
  return out;
}

export function scaleFor(box: Box, g: Geometry = LANDSCAPE): number {
  const fit = Math.min(g.VIEW.w / (box.width + 2 * PAD), g.VIEW.h / (box.height + 2 * PAD)) * 1.2;
  return Math.min(g.ZOOM.max, Math.max(g.ZOOM.min, fit));
}

/** Groups interests that are close in time and fit in one zoomed view into shots. */
export function shots(events: TimelineEvent[], g: Geometry = LANDSCAPE): Shot[] {
  const list = interests(events, g).sort((a, b) => a.t - b.t);
  const out: Shot[] = [];
  let group: Interest[] = [];
  const flush = () => {
    if (!group.length) return;
    const box = group.map((g) => g.box).reduce(union);
    const scale = group.find((i) => i.scale)?.scale ?? scaleFor(box, g);
    out.push({ from: group[0].t - LEAD, to: group.at(-1)!.t + HOLD, cam: clampCam({ s: scale, x: box.x + box.width / 2, y: box.y + box.height / 2 }, g) });
    group = [];
  };
  for (const i of list) {
    if (group.length) {
      const box = [...group.map((x) => x.box), i.box].reduce(union);
      const fits = box.width + 2 * PAD <= g.VIEW.w / g.ZOOM.min && box.height + 2 * PAD <= g.VIEW.h / g.ZOOM.min;
      if (i.t - group.at(-1)!.t > GROUP_GAP || !fits || i.scale || group[0].scale) flush();
    }
    group.push(i);
  }
  flush();
  return out;
}

/**
 * Where the camera wants to be at time t: the latest shot that has started and not ended, else wide. With `holdX` the
 * wide shot stays across from the last shot, so a frame narrower than the window keeps the action in view.
 */
export function targetAt(list: Shot[], t: number, g: Geometry = LANDSCAPE): Cam {
  let cam = g.WIDE;
  for (const s of list) {
    if (s.from > t) break;
    cam = t < s.to ? s.cam : g.holdX ? { ...g.WIDE, x: s.cam.x } : g.WIDE;
  }
  return cam;
}

/**
 * Camera for every frame: the target smoothed by a critically damped spring (no overshoot), on log scale for
 * zoom so zooming in and out feel equally fast. Returns [s, x, y] per frame.
 */
export function cameraTrack(events: TimelineEvent[], duration: number, g: Geometry = LANDSCAPE, fps = FPS, omega = 5.5): Cam[] {
  const list = shots(events, g);
  const n = Math.ceil(duration * fps);
  const dt = 1 / fps;
  let cur = { ls: Math.log(g.WIDE.s), x: g.WIDE.x, y: g.WIDE.y };
  const vel = { ls: 0, x: 0, y: 0 };
  const out: Cam[] = [];
  for (let f = 0; f < n; f++) {
    const target = targetAt(list, f / fps, g);
    const goal = { ls: Math.log(target.s), x: target.x, y: target.y };
    for (const k of ['ls', 'x', 'y'] as const) {
      vel[k] += (omega * omega * (goal[k] - cur[k]) - 2 * omega * vel[k]) * dt;
      cur = { ...cur, [k]: cur[k] + vel[k] * dt };
    }
    out.push(clampCam({ s: Math.exp(cur.ls), x: cur.x, y: cur.y }, g));
  }
  return out;
}
