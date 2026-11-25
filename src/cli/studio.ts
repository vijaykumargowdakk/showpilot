// showpilot studio <cut> [--port <n>] [--no-open]
// Opens a recorded cut in Remotion Studio: play it, scrub it and step through frames without rendering. The render
// plan is written first, as `render` does, and the project's out/ folder is served as Studio's public folder where it
// is (Studio doesn't copy it, unlike a render bundle). While Studio runs, saving the cut or the config writes the plan
// again and the Studio page reloads with it. Studio shows the picture and the narration; music is mixed in only by
// `showpilot render`.
import { spawn } from 'node:child_process';
import { readFileSync, watch } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadConfig, loadCut } from '../config';
import { OUT, PKG, PROJECT } from '../paths.mjs';
import { writePlan } from '../video/plan';
import { brandFor } from './brand';

const args = process.argv.slice(2);
const id = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port');
const cut = await loadCut(id);
console.log(`planned ${path.relative(OUT, writePlan(cut, brandFor(await loadConfig())))}`);

const pkg = createRequire(import.meta.url).resolve('@remotion/cli/package.json');
const cli = path.join(path.dirname(pkg), JSON.parse(readFileSync(pkg, 'utf8')).bin.remotion);
const entry = path.join(PKG, 'src', 'video', 'remotion', 'index.ts');
const props = JSON.stringify({ cut: cut.id, clean: !!cut.silent });
const passed = args.filter((a, i) => a.startsWith('--') || args[i - 1] === '--port');

console.log(`Opening ${cut.id} in Remotion Studio: choose "Cut" on the left. Edits to the cut show up when you save. Ctrl+C stops it.`);
const studio = spawn(process.execPath, [cli, 'studio', entry, '--public-dir', OUT, '--props', props, ...passed], { cwd: PKG, stdio: 'inherit' });
studio.on('exit', (code) => process.exit(code ?? 1));

// Editors often save by replacing the file, which ends a watch on the file itself, so the folders are watched.
let timer: NodeJS.Timeout | undefined;
const replan = async () => {
  try {
    const [fresh, config] = await Promise.all([loadCut(id, true), loadConfig(true)]);
    writePlan(fresh, brandFor(config));
    console.log(`re-planned ${cut.id} after your edit; Studio reloads it`);
  } catch (e) {
    // A half-typed edit doesn't stop Studio; the next save tries again.
    console.error(`couldn't re-plan ${cut.id}: ${(e as Error).message.split('\n')[0]}`);
  }
};
const onChange = (name: string) => (_event: string, file: string | null) => {
  if (file !== name) return;
  clearTimeout(timer);
  timer = setTimeout(replan, 300);
};
watch(path.join(PROJECT, 'cuts'), onChange(`${cut.id}.ts`));
watch(PROJECT, onChange('showpilot.config.ts'));
