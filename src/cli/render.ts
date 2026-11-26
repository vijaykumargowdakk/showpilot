// showpilot render <cut> [--clean] [--4k] [--still <frame>,<frame>...]
// Plans the camera and cursor from the recording, then renders out/<cut>/<cut>.mp4, or with --still only those frames
// as PNGs in out/<cut>/stills/ to check a layout. --clean renders <cut>-clean.mp4 with no captions and no audio (the
// scenes' on-screen words stay); a silent cut always renders that way, as <cut>.mp4. Every video render also writes
// the .srt, the timestamped script and the chapter list. With `music` in the config, it plays under the video (a
// silent cut's only sound), dipping under the narration; --clean renders stay without it. With size: '4k' in the
// config the video (and stills) are 3840×2160; --4k scales a 1080p recording up instead. Concurrency is half the
// CPU threads (RENDER_CONCURRENCY overrides it) so the computer stays usable.
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut, musicOf } from '../config';
import { OUT } from '../paths.mjs';
import { narrationSpans } from '../video/music';
import { planCut, writePlan } from '../video/plan';
import { brandFor } from './brand';
import { chromiumOptions, withBundle } from './bundle';
import { addMusic } from './mix';
import { writeSubtitles } from './subtitles';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const stills = flag('--still') ? args[args.indexOf('--still') + 1].split(',').map(Number) : null;
const config = await loadConfig();
const cut = await loadCut(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--still'));
const clean = flag('--clean') || !!cut.silent;
const brand = brandFor(config);
const music = flag('--clean') ? undefined : musicOf(config);
console.log(`planned ${path.relative(OUT, writePlan(cut, brand, config.layout))}`);
const plan = planCut(cut, brand, config.layout);

// 4K wants a recording made at twice the density; a 1080p recording rendered at 4K is only scaled up.
const fourK = config.size === '4k';
const scale = fourK || flag('--4k') ? 2 : 1;
const recordedScales = readdirSync(path.join(OUT, cut.id))
  .filter((d) => /^ch\d+$/.test(d))
  .map((d) => path.join(OUT, cut.id, d, 'timeline.json'))
  .filter(existsSync)
  .map((f) => (JSON.parse(readFileSync(f, 'utf8')) as { scale?: number }).scale ?? 1);
if (scale === 2 && recordedScales.some((s) => s < 2)) {
  console.log(
    fourK
      ? 'Some chapters were recorded before size: \'4k\' was set, so their text is scaled up. Record again for sharp 4K.'
      : '--4k scales a 1080p recording up, so text is soft. For sharp text, set size: \'4k\' in showpilot.config.ts and record again.',
  );
}

const output = path.join(OUT, cut.id, `${cut.id}${flag('--4k') && !fourK ? '-4k' : ''}${flag('--clean') ? '-clean' : ''}.mp4`);
// With music, the render goes to a hidden file first and the music is mixed from it into the output.
const rendered = music ? path.join(path.dirname(output), `.${path.basename(output, '.mp4')}-unmixed.mp4`) : output;
await withBundle(cut.id, async (serveUrl) => {
  const inputProps = { cut: cut.id, clean };
  const composition = await selectComposition({ serveUrl, id: 'Cut', inputProps, chromiumOptions });
  if (stills) {
    mkdirSync(path.join(OUT, cut.id, 'stills'), { recursive: true });
    for (const frame of stills) {
      const file = path.join(OUT, cut.id, 'stills', `${frame}.png`);
      await renderStill({ serveUrl, composition, inputProps, frame, output: file, scale: fourK ? 2 : 1, chromiumOptions });
      console.log(`→ ${file}`);
    }
    return;
  }
  let last = -1;
  const started = Date.now();
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    crf: 17,
    audioBitrate: '320k',
    muted: clean,
    outputLocation: rendered,
    concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : '50%',
    scale,
    chromiumOptions,
    onProgress: ({ progress, renderedFrames }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last && pct % 5 === 0) {
        last = pct;
        const secs = (Date.now() - started) / 1000;
        console.log(`  ${String(pct).padStart(3)}%  ${renderedFrames}/${composition.durationInFrames} frames  ${(renderedFrames / Math.max(secs, 0.1)).toFixed(1)} fps`);
      }
    },
  });
  if (music) {
    console.log(`mixing in ${path.basename(music.file)}`);
    addMusic(rendered, music, plan.frames / plan.fps, narrationSpans(plan), !clean, output);
    rmSync(rendered);
  }
  console.log(`\n→ ${output}`);
  for (const f of writeSubtitles(path.join(OUT, cut.id), plan, cut.title)) console.log(`→ ${f}`);
});
