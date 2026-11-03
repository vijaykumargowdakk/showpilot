// showpilot where: every folder Showpilot uses, with sizes. Deleting SHOWPILOT_HOME uninstalls the heavy parts;
// a project's out/ folder holds only that project's recordings and videos.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { CACHE, HOME, OUT, REDIRECTS, VENV } from '../paths.mjs';

function size(p) {
  if (!existsSync(p)) return 0;
  const s = statSync(p);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const name of readdirSync(p)) total += size(path.join(p, name));
  return total;
}

const fmt = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const places = [
  ['Chromium for recording', REDIRECTS.PLAYWRIGHT_BROWSERS_PATH],
  ['Voice: Python environment (Kokoro, torch)', VENV],
  ['Voice: model and voices', REDIRECTS.HF_HOME],
  ['Download caches (npm, pip) and temp files', CACHE],
  ['This project: recordings, narration, videos', OUT],
];
for (const [label, p] of places) console.log(`${fmt(size(p)).padStart(10)}  ${label}\n            ${p}`);
console.log(`\nTo uninstall everything except your projects' outputs, delete: ${HOME}`);
