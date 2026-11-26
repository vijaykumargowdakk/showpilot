// Where the app window sits in the frame, and how app coordinates map onto it, for each video layout. Shared by the
// recorder, the planner (Node) and the Remotion compositions, so the capture, the camera and the drawing always agree.
export const FPS = 60;

/**
 * 'landscape': a 1920×1080 video of the app at desktop size. 'vertical-phone': a 1080×1920 video of the app at phone
 * size (its mobile layout), in a phone-shaped frame.
 */
export type Layout = 'landscape' | 'vertical-phone';
export const LAYOUTS: Layout[] = ['landscape', 'vertical-phone'];

export type Cam = { s: number; x: number; y: number };

export type Geometry = {
  layout: Layout;
  /** The video frame. */
  OUT: { w: number; h: number };
  /** The recorded app's viewport, in CSS pixels. */
  VIEW: { w: number; h: number };
  /** The browser window the recorder opens, and its pixel density (before `size: '4k'` doubles it). */
  CAPTURE: { width: number; height: number; scale: number };
  /** The window as drawn when the camera is wide: a title bar over the app, with background around it. */
  WIN: { w: number; h: number; titlebar: number };
  K: number;
  WIN_X: number;
  WIN_Y: number;
  CONTENT_Y: number;
  /** Title bar height in app pixels. */
  TITLEBAR_VIEW: number;
  /** The wide shot: the whole window in view. s = 1 means no zoom. */
  WIDE: Cam;
  /** How far the camera zooms in on an action: beyond `max` the capture's text starts to look soft. */
  ZOOM: { min: number; max: number; focus: number };
};

function geometry(layout: Layout, OUT: Geometry['OUT'], VIEW: Geometry['VIEW'], scale: number, winW: number, titlebar: number, top: number | null, ZOOM: Geometry['ZOOM']): Geometry {
  const K = winW / VIEW.w;
  const WIN = { w: winW, h: VIEW.h * K, titlebar };
  const WIN_X = (OUT.w - WIN.w) / 2;
  const WIN_Y = top ?? (OUT.h - (WIN.h + WIN.titlebar)) / 2;
  const CONTENT_Y = WIN_Y + WIN.titlebar;
  return {
    layout,
    OUT,
    VIEW,
    CAPTURE: { width: VIEW.w, height: VIEW.h, scale },
    WIN,
    K,
    WIN_X,
    WIN_Y,
    CONTENT_Y,
    TITLEBAR_VIEW: titlebar / K,
    WIDE: { s: 1, x: VIEW.w / 2, y: (OUT.h / 2 - CONTENT_Y) / K },
    ZOOM,
  };
}

const GEOMETRY: Record<Layout, Geometry> = {
  landscape: geometry('landscape', { w: 1920, h: 1080 }, { w: 1920, h: 1080 }, 1, 1600, 40, null, { min: 1.4, max: 1.8, focus: 1.6 }),
  // A large phone's width; the height leaves room under the frame for captions. Captured at 3× so the window,
  // drawn at 2×, stays sharp when the camera moves in a little.
  'vertical-phone': geometry('vertical-phone', { w: 1080, h: 1920 }, { w: 430, h: 770 }, 3, 860, 44, 110, { min: 1.15, max: 1.4, focus: 1.3 }),
};

export const geometryFor = (layout: Layout = 'landscape'): Geometry => GEOMETRY[layout];

export const LANDSCAPE = GEOMETRY.landscape;

/** App point → point on the stage (the frame before the camera moves). */
export const toStage = (g: Geometry, x: number, y: number) => ({ x: g.WIN_X + x * g.K, y: g.CONTENT_Y + y * g.K });

/** Keeps the zoomed view inside the window, so the camera never shows past its edges. */
export function clampCam(c: Cam, g: Geometry = LANDSCAPE): Cam {
  const hw = g.OUT.w / 2 / (g.K * c.s);
  const hh = g.OUT.h / 2 / (g.K * c.s);
  const x = hw >= g.VIEW.w / 2 ? g.WIDE.x : Math.min(g.VIEW.w - hw, Math.max(hw, c.x));
  const top = -g.TITLEBAR_VIEW;
  const y = 2 * hh >= g.VIEW.h - top ? g.WIDE.y : Math.min(g.VIEW.h - hh, Math.max(top + hh, c.y));
  return { s: c.s, x, y };
}
