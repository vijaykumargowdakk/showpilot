// showpilot thumbnail <cut>: renders the cut's thumbnail (cut.thumbnail) as out/<cut>/thumbnail-1.jpg, -2.jpg, …
// one per headline: the headline and chips on the left, the chosen recorded screenshot cropped and tilted on the right.
import { renderStill, selectComposition } from '@remotion/renderer';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT } from '../paths.mjs';
import { brandFor } from './brand';
import { chromiumOptions, withBundle } from './bundle';

const config = await loadConfig();
const cut = await loadCut(process.argv[2]);
const spec = cut.thumbnail;
if (!spec) throw new Error(`${cut.id} has no thumbnail: add thumbnail: { chapter, at, crop, headlines } to the cut`);
const dir = path.join(OUT, cut.id, `ch${String(spec.chapter).padStart(2, '0')}`);
const tl = JSON.parse(readFileSync(path.join(dir, 'timeline.json'), 'utf8')) as { shots: { t: number; file: string }[] };
const shot = path.relative(OUT, path.join(dir, 'frames', tl.shots.filter((s) => s.t <= spec.at).pop()!.file)).replaceAll('\\', '/');
const brand = brandFor(config);

await withBundle(`${cut.id}-thumbnail`, async (serveUrl) => {
  for (const [i, headline] of spec.headlines.entries()) {
    const inputProps = { brand, shot, crop: spec.crop, lines: headline.lines, accentFrom: headline.accentFrom ?? headline.lines.length, chips: spec.chips ?? [] };
    const composition = await selectComposition({ serveUrl, id: 'Thumbnail', inputProps, chromiumOptions });
    const output = path.join(OUT, cut.id, `thumbnail-${i + 1}.jpg`);
    await renderStill({ serveUrl, composition, inputProps, output, imageFormat: 'jpeg', jpegQuality: 92, chromiumOptions });
    console.log(`→ ${output}`);
  }
});
