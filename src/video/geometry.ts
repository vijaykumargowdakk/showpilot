// Where the app window sits in the 1920×1080 frame, and how app coordinates map onto it. Shared by the planner
// (Node) and the Remotion compositions, so the camera and the drawing always agree.
export const FPS = 60;
export const OUT = { w: 1920, h: 1080 };
/** The recorded app's viewport, in CSS pixels. */
export const VIEW = { w: 1920, h: 1080 };
/** The browser window the recorder opens, and its pixel density (1080p capture, rendered at 1080p60). */
export const CAPTURE = { width: VIEW.w, height: VIEW.h, scale: 1 };
/** The window as drawn when the camera is wide: a title bar over the app, centred with a margin of background. */
export const WIN = { w: 1600, h: 900, titlebar: 40 };
export const K = WIN.w / VIEW.w;
export const WIN_X = (OUT.w - WIN.w) / 2;
export const WIN_Y = (OUT.h - (WIN.h + WIN.titlebar)) / 2;
export const CONTENT_Y = WIN_Y + WIN.titlebar;
/** Title bar height in app pixels. */
export const TITLEBAR_VIEW = WIN.titlebar / K;

export type Cam = { s: number; x: number; y: number };

/** App point → point on the stage (the 1920×1080 frame before the camera moves). */
export const toStage = (x: number, y: number) => ({ x: WIN_X + x * K, y: CONTENT_Y + y * K });

/** The wide shot: the whole window centred. s = 1 means no zoom. */
export const WIDE: Cam = { s: 1, x: VIEW.w / 2, y: (OUT.h / 2 - CONTENT_Y) / K };

/** Keeps the zoomed view inside the window, so the camera never shows past its edges. */
export function clampCam(c: Cam): Cam {
  const hw = OUT.w / 2 / (K * c.s);
  const hh = OUT.h / 2 / (K * c.s);
  const x = hw >= VIEW.w / 2 ? WIDE.x : Math.min(VIEW.w - hw, Math.max(hw, c.x));
  const top = -TITLEBAR_VIEW;
  const y = 2 * hh >= VIEW.h - top ? WIDE.y : Math.min(VIEW.h - hh, Math.max(top + hh, c.y));
  return { s: c.s, x, y };
}
