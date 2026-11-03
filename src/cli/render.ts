// showpilot render <cut> [--clean] [--4k] [--still <frame>,<frame>...]
// Plans the camera and cursor from the recording, then renders out/<cut>/<cut>.mp4, or with --still only those frames
// as PNGs in out/<cut>/stills/ to check a layout. --clean renders <cut>-clean.mp4 with no captions and no audio (the
// scenes' on-screen words stay); a silent cut always renders that way, as <cut>.mp4. Every video render also writes
// the .srt, the timestamped script and the chapter list. Concurrency is half the CPU threads (RENDER_CONCURRENCY
// overrides it) so the computer stays usable.
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT } from '../paths.mjs';
import { planCut, writePlan } from '../video/plan';
import { brandFor } from './brand';
import { chromiumOptions, withBundle } from './bundle';
import { writeSubtitles } from './subtitles';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const stills = flag('--still') ? args[args.indexOf('--still') + 1].split(',').map(Number) : null;
const config = await loadConfig();
const cut = await loadCut(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--still'));
const clean = flag('--clean') || !!cut.silent;
const brand = brandFor(config);
console.log(`planned ${path.relative(OUT, writePlan(cut, brand))}`);

const output = path.join(OUT, cut.id, `${cut.id}${flag('--4k') ? '-4k' : ''}${flag('--clean') ? '-clean' : ''}.mp4`);
await withBundle(cut.id, async (serveUrl) => {
  const inputProps = { cut: cut.id, clean };
  const composition = await selectComposition({ serveUrl, id: 'Cut', inputProps, chromiumOptions });
  if (stills) {
    mkdirSync(path.join(OUT, cut.id, 'stills'), { recursive: true });
    for (const frame of stills) {
      const file = path.join(OUT, cut.id, 'stills', `${frame}.png`);
      await renderStill({ serveUrl, composition, inputProps, frame, output: file, chromiumOptions });
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
    outputLocation: output,
    concurrency: process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : '50%',
    scale: flag('--4k') ? 2 : 1,
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
  console.log(`\n→ ${output}`);
  for (const f of writeSubtitles(path.join(OUT, cut.id), planCut(cut, brand), cut.title)) console.log(`→ ${f}`);
});
