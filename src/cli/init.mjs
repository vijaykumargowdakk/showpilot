// showpilot init: starts a project in the current folder (or --project): a config, a first cut and a .gitignore.
// Existing files are never overwritten.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECT } from '../paths.mjs';

const name = path.basename(PROJECT);
const files = {
  'showpilot.config.ts': `import { defineConfig } from 'showpilot';

export default defineConfig({
  app: {
    // The page to record. Or serve a production build yourself: serve: '../dist'
    url: 'http://localhost:5173',
    // A selector that is on screen once the app is ready to film.
    ready: 'body',
  },
  brand: { name: '${name}', links: [{ label: 'Try it', url: 'https://example.com' }] },
  // The narrator: \`showpilot voices\` lets you hear them all and writes your pick on the line below.
  // showpilot:voice
  // voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
});
`,
  'cuts/tour.ts': `import { beat, chapter, cut, scene } from 'showpilot';

export default cut({
  id: 'tour',
  title: '${name}: a quick tour',
  // Silent: each line is shown for as long as it takes to read, and written to out/tour/tour.srt.
  silent: true,
  chapters: [
    scene('Hello', 'kinetic', [beat({ say: 'Meet ${name}.' })]),
    chapter('First look', [
      beat({
        say: 'This is the home screen.',
        camera: 'wide',
        do: async (s) => s.moveTo({ x: 960, y: 540 }),
      }),
    ]),
    scene('Thanks', 'cta', [beat({ say: 'Thanks for watching!' })]),
  ],
});
`,
};

for (const [file, text] of Object.entries(files)) {
  const target = path.join(PROJECT, file);
  if (existsSync(target)) {
    console.log(`  kept     ${file} (already there)`);
    continue;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`  created  ${file}`);
}
const ignore = path.join(PROJECT, '.gitignore');
if (!existsSync(ignore) || !readFileSync(ignore, 'utf8').split('\n').includes('out/')) {
  appendFileSync(ignore, '\n# Showpilot recordings, narration and videos\nout/\n');
  console.log('  updated  .gitignore (out/)');
}
console.log(`\nNext:\n  npm install --save-dev showpilot\n  npx showpilot check tour\n  npx showpilot record tour\n  npx showpilot render tour`);
