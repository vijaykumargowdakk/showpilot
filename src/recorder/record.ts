// Records a cut: showpilot record <cut> [--chapter N | --from N]
// Each chapter gets out/<cut>/chNN/frames/*.jpg (a screenshot whenever the screen changed) and timeline.json
// (screenshot times, beats and actions, in seconds from the start). While capturing, screenshots are only written
// to disk, so nothing competes with the page being recorded.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { fromProject, loadConfig, loadCut, type Config } from '../config';
import { CAPTURE } from '../video/geometry';
import { OUT } from '../paths.mjs';
import { beatId, lineSeconds, sceneSeconds, type Cut } from './script';
import { serve } from './serve';
import { now, Studio } from './studio';

type Narration = Record<string, { duration: number }>;

function loadNarration(cutId: string): Narration | null {
  const file = path.join(OUT, cutId, 'voice', 'voice.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Narration) : null;
}

async function recordChapter(config: Config, appUrl: string, cut: Cut, index: number, narration: Narration | null) {
  const chapter = cut.chapters[index];
  const dir = path.join(OUT, cut.id, `ch${String(index + 1).padStart(2, '0')}`);
  const framesDir = path.join(dir, 'frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  console.log(`\n● Chapter ${index + 1}: ${chapter.title}`);

  const { width, height, scale } = CAPTURE;
  // Density is forced at launch: with Playwright's deviceScaleFactor the screencast still sends 1× frames.
  const browser = await chromium.launch({ headless: true, args: [`--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`] });
  const context = await browser.newContext({ viewport: null, serviceWorkers: chapter.offline ? 'allow' : 'block', colorScheme: config.app.colorScheme ?? 'light' });
  // Storage is reset once per take (not on every reload), so a chapter can show that the app keeps its work.
  await context.addInitScript(
    ({ reset, storage }) => {
      if (sessionStorage.getItem('showpilot:init')) return;
      sessionStorage.setItem('showpilot:init', '1');
      if (reset) localStorage.clear();
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
    },
    { reset: config.app.resetStorage ?? true, storage: config.app.storage ?? {} },
  );
  const page = await context.newPage();
  if (chapter.kind === 'web') {
    await page.goto(chapter.url!);
    await page.waitForLoadState('load');
  } else {
    await page.goto(appUrl);
    if (config.app.ready) await page.locator(config.app.ready).first().waitFor();
    else await page.waitForLoadState('load');
  }
  const studio = new Studio(page, context);
  // Confirmations are accepted and prompts answered, so a dialog never stalls a take.
  page.on('dialog', (d) => void d.accept(d.type() === 'prompt' ? studio.answer : undefined).catch(() => {}));
  if (chapter.setup) await chapter.setup(studio);
  await studio.settle();
  studio.events.length = 0;

  // Screencast: every frame is acknowledged at once and written to disk in the background.
  const cdp = await context.newCDPSession(page);
  const frames: { t: number; file: string }[] = [];
  const writes: Promise<void>[] = [];
  cdp.on('Page.screencastFrame', (f) => {
    const file = `${String(frames.length).padStart(6, '0')}.jpg`;
    frames.push({ t: f.metadata.timestamp ?? now(), file });
    writes.push(writeFile(path.join(framesDir, file), Buffer.from(f.data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const t0 = now();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width * scale, maxHeight: height * scale });
  await studio.wait(0.6);

  if (chapter.kind === 'scene') {
    // B-roll behind a scene: the actions just run, and the take lasts as long as the scene's narration.
    const spoken = (i: number) => (cut.silent ? undefined : narration?.[beatId(index, i)]?.duration) ?? lineSeconds(cut, chapter.beats[i].say ?? '');
    const length = sceneSeconds(chapter.beats, spoken);
    studio.wide();
    await chapter.broll!(studio);
    const elapsed = now() - t0;
    if (elapsed > length) console.log(`  ! b-roll took ${elapsed.toFixed(1)} s, the scene is ${length.toFixed(1)} s`);
    await studio.wait(Math.max(0, length - elapsed));
  }
  for (const [i, beat] of (chapter.kind === 'scene' ? [] : chapter.beats).entries()) {
    const id = beatId(index, i);
    // Sped-up chapters are acted, not narrated: each beat takes as long as its actions.
    const said = chapter.speed ? '' : (beat.say ?? '');
    const voiced = said ? (cut.silent ? undefined : narration?.[id]?.duration) : 0;
    const duration = voiced ?? lineSeconds(cut, said);
    const start = now();
    studio.log({ t: start, type: 'beat', id, say: beat.say, duration });
    if (beat.camera === 'wide') studio.wide();
    else if (beat.camera && beat.camera !== 'auto') {
      const focus = typeof beat.camera.focus === 'function' ? await beat.camera.focus(studio) : beat.camera.focus;
      await studio.focus(focus, beat.camera.scale);
    }
    await studio.wait(beat.lead ?? 0.3);
    if (beat.do) await beat.do(studio);
    const elapsed = now() - start;
    const target = duration + (beat.hold ?? 0.35);
    if (!chapter.speed && elapsed > target + 0.05) console.log(`  ! ${id}: actions took ${elapsed.toFixed(1)} s, narration is ${duration.toFixed(1)} s`);
    await studio.wait(Math.max(0, target - elapsed));
    console.log(`  ${id} ${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s  ${(beat.say ?? '').replace(/\s+/g, ' ').slice(0, 70)}`);
  }
  await studio.wait(0.6);
  const t1 = now();
  await cdp.send('Page.stopScreencast');
  await Promise.all(writes);
  await browser.close();

  const rel = (t: number) => Math.round((t - t0) * 1000) / 1000;
  const events = studio.events.map((e) => ({ ...e, t: rel(e.t) }));
  // The screenshots themselves are the footage: each is shown from its timestamp until the next one arrives.
  const shots = frames.map((f, i) => ({ t: i === 0 ? 0 : rel(f.t), file: f.file }));
  writeFileSync(
    path.join(dir, 'timeline.json'),
    JSON.stringify({ cut: cut.id, chapter: index, title: chapter.title, duration: rel(t1), viewport: { width, height }, scale, shots, events }, null, 1),
  );
  console.log(`  captured ${frames.length} screenshots in ${(t1 - t0).toFixed(1)} s → ${path.relative(OUT, dir)}`);
}

const args = process.argv.slice(2);
const only = args.includes('--chapter') ? Number(args[args.indexOf('--chapter') + 1]) - 1 : null;
const from = args.includes('--from') ? Number(args[args.indexOf('--from') + 1]) - 1 : 0;
const config = await loadConfig();
const cut = await loadCut(args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')));
const narration = cut.silent ? null : loadNarration(cut.id);
if (cut.silent) console.log('Silent cut: each line is paced for reading.');
else if (!narration) console.log('No narration yet (showpilot voice); pacing beats by estimated line lengths.');
const server = config.app.serve ? await serve(fromProject(config.app.serve)) : null;
if (server) console.log(`Serving ${config.app.serve} at ${server.url}`);
try {
  for (let i = 0; i < cut.chapters.length; i++) {
    if (cut.chapters[i].kind === 'scene' && !cut.chapters[i].broll) continue; // drawn by the renderer
    if (only === null ? i >= from : only === i) await recordChapter(config, server?.url ?? config.app.url!, cut, i, narration);
  }
} finally {
  await server?.close();
}
