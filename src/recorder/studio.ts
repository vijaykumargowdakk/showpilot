// Drives the app like a person would (eased mouse paths, short pauses, typing at human speed) and logs every
// action with a timestamp, so the renderer can draw the cursor and move the camera afterwards.
import type { BrowserContext, Locator, Page } from 'playwright';
import type { Box } from './script';

export type Point = { x: number; y: number };

export type Event =
  | { t: number; type: 'move'; x: number; y: number }
  | { t: number; type: 'down' | 'up'; x: number; y: number }
  | { t: number; type: 'click'; x: number; y: number; box: Box; label?: string }
  | { t: number; type: 'type'; box: Box; text: string }
  | { t: number; type: 'keys'; keys: string[] }
  | { t: number; type: 'drag'; from: Box; x: number; y: number; label?: string }
  | { t: number; type: 'focus'; box: Box; scale?: number }
  | { t: number; type: 'wide' }
  | { t: number; type: 'beat'; id: string; say?: string; duration: number }
  | { t: number; type: 'callout'; box: Box; text: string };

export const now = () => Date.now() / 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

export class Studio {
  readonly events: Event[] = [];
  private pos: Point = { x: 960, y: 620 };
  /** What a window.prompt() is answered with; confirm() and alert() are always accepted. */
  answer = '';

  constructor(
    readonly page: Page,
    readonly context: BrowserContext,
  ) {}

  log(e: Event) {
    this.events.push(e);
  }

  async wait(seconds: number) {
    await sleep(seconds * 1000);
  }

  /** Waits a moment for animations to finish (after loading, opening a dialog or switching views). */
  async settle() {
    await sleep(400);
  }

  /** Glides the real mouse along a gently curved path, logging samples for the rendered cursor. */
  async moveTo(to: Point, seconds?: number) {
    const from = this.pos;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (dist < 1) return;
    const duration = seconds ?? Math.min(0.9, 0.28 + dist / 2600);
    // Control point off the straight line, so the path bows slightly like a hand movement.
    const bow = Math.min(80, dist * 0.12) * (to.x > from.x ? 1 : -1);
    const ctrl = { x: (from.x + to.x) / 2 - ((to.y - from.y) / dist) * bow, y: (from.y + to.y) / 2 + ((to.x - from.x) / dist) * bow };
    const start = now();
    for (;;) {
      const p = Math.min(1, (now() - start) / duration);
      const e = ease(p);
      const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * ctrl.x + e * e * to.x;
      const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * ctrl.y + e * e * to.y;
      await this.page.mouse.move(x, y);
      this.log({ t: now(), type: 'move', x, y });
      if (p >= 1) break;
      await sleep(12);
    }
    this.pos = to;
  }

  async box(target: Locator): Promise<Box> {
    await target.waitFor({ state: 'visible' });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`No bounding box for ${target}`);
    return box;
  }

  /** A point inside the box, slightly off-centre the way people click. */
  private aim(box: Box): Point {
    return { x: box.x + box.width * (0.42 + Math.random() * 0.16), y: box.y + box.height * (0.4 + Math.random() * 0.2) };
  }

  async click(target: Locator, label?: string) {
    const box = await this.box(target);
    const at = this.aim(box);
    await this.moveTo(at);
    await sleep(110);
    this.log({ t: now(), type: 'down', ...at });
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
    this.log({ t: now(), type: 'up', ...at });
    this.log({ t: now(), type: 'click', ...at, box, label });
    await sleep(150);
  }

  async hover(target: Locator, seconds = 0.6) {
    await this.moveTo(this.aim(await this.box(target)));
    await this.wait(seconds);
  }

  /** Clicks a field, selects what is there, and types at a human pace. */
  async type(target: Locator, text: string) {
    await this.click(target);
    await this.page.keyboard.press('Control+A');
    const box = await this.box(target);
    this.log({ t: now(), type: 'type', box, text });
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await sleep(45 + Math.random() * 70);
    }
  }

  /** Presses a shortcut and shows it in the keycap overlay, e.g. press('Control+K'). */
  async press(combo: string) {
    this.log({ t: now(), type: 'keys', keys: combo.split('+').map((k) => (k === 'Control' ? 'Ctrl' : k)) });
    await this.page.keyboard.press(combo);
    await sleep(250);
  }

  /** Tells the camera to frame something, without clicking it. */
  async focus(target: Locator | Box, scale?: number) {
    const box = 'x' in target ? target : await this.box(target);
    this.log({ t: now(), type: 'focus', box, scale });
  }

  wide() {
    this.log({ t: now(), type: 'wide' });
  }

  /** Pins a short label next to something on screen. */
  async callout(target: Locator, text: string) {
    this.log({ t: now(), type: 'callout', box: await this.box(target), text });
  }

  /**
   * Drags an element (HTML5 drag and drop) to a point. The cursor glides from the element to the drop point; the drop is
   * delivered as DOM drag events, because Playwright cannot drive HTML5 drag and drop in Chromium reliably.
   */
  async dragAndDrop(item: Locator, to: Point, label?: string) {
    const from = await this.box(item);
    const grab = this.aim(from);
    await this.moveTo(grab);
    await sleep(120);
    this.log({ t: now(), type: 'down', ...grab });
    this.log({ t: now(), type: 'drag', from, x: to.x, y: to.y, label });
    await this.moveTo(to, 0.9);
    await item.evaluate(
      (el, { x, y }) => {
        const dt = new DataTransfer();
        el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
        const target = document.elementFromPoint(x, y) ?? document.body;
        const init = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y };
        target.dispatchEvent(new DragEvent('dragenter', init));
        target.dispatchEvent(new DragEvent('dragover', init));
        target.dispatchEvent(new DragEvent('drop', init));
        el.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      },
      to,
    );
    this.log({ t: now(), type: 'up', ...to });
    await sleep(200);
  }

  /** Scrolls the page under the cursor smoothly, in small wheel steps. */
  async scroll(dy: number, seconds = 1.2) {
    const steps = Math.max(1, Math.round(seconds * 30));
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, dy / steps);
      await sleep((seconds * 1000) / steps);
    }
  }

  /**
   * Scrolls smoothly until the target sits `top` pixels below the top of the window (headings on a long page).
   * Unlike box(), it never jumps the page, so the move is seen.
   */
  async scrollTo(target: Locator, seconds = 1.4, top = 110) {
    await target.waitFor({ state: 'attached' });
    const box = await target.boundingBox();
    if (!box) throw new Error(`No bounding box for ${target}`);
    await this.scroll(box.y - top, seconds);
  }

  /** Runs an action that downloads a file and saves it as `to` (so it keeps its extension and can be opened). */
  async download(action: () => Promise<void>, to: string): Promise<string> {
    const [file] = await Promise.all([this.page.waitForEvent('download'), action()]);
    await file.saveAs(to);
    return to;
  }

  /** Opens another page in the same tab and waits for it to finish loading. */
  async goto(url: string) {
    // Content is readable well before every asset has loaded (GitHub can take 15 s for 'load').
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.wait(1.2);
  }

  /** Drags on the canvas with the real mouse (panning, moving a device). */
  async drag(from: Point, to: Point, seconds = 0.8) {
    await this.moveTo(from);
    this.log({ t: now(), type: 'down', ...from });
    await this.page.mouse.down();
    await this.moveTo(to, seconds);
    await this.page.mouse.up();
    this.log({ t: now(), type: 'up', ...to });
  }
}
