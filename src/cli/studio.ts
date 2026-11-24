// showpilot studio <cut> [--port <n>] [--no-open]
// Opens a recorded cut in Remotion Studio: play it, scrub it and step through frames without rendering. The render
// plan is written first, as `render` does, and the project's out/ folder is served as Studio's public folder where it
// is (Studio doesn't copy it, unlike a render bundle). The plan is made once at start, so restart Studio after editing
// the cut. Studio shows the picture and the narration; music is mixed in only by `showpilot render`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT, PKG } from '../paths.mjs';
import { writePlan } from '../video/plan';
import { brandFor } from './brand';

const args = process.argv.slice(2);
const cut = await loadCut(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port'));
const config = await loadConfig();
console.log(`planned ${path.relative(OUT, writePlan(cut, brandFor(config)))}`);

const pkg = createRequire(import.meta.url).resolve('@remotion/cli/package.json');
const cli = path.join(path.dirname(pkg), JSON.parse(readFileSync(pkg, 'utf8')).bin.remotion);
const entry = path.join(PKG, 'src', 'video', 'remotion', 'index.ts');
const props = JSON.stringify({ cut: cut.id, clean: !!cut.silent });
const passed = args.filter((a, i) => a.startsWith('--') || args[i - 1] === '--port');

console.log(`Opening ${cut.id} in Remotion Studio: choose "Cut" on the left. Ctrl+C stops it.`);
const r = spawnSync(process.execPath, [cli, 'studio', entry, '--public-dir', OUT, '--props', props, ...passed], { cwd: PKG, stdio: 'inherit' });
process.exit(r.status ?? 1);
