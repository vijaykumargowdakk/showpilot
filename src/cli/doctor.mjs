// showpilot doctor: checks what each stage needs, and shows where everything is kept.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { env, HOME, OUT, PROJECT, PYTHON, REDIRECTS } from '../paths.mjs';

let failed = false;
const ok = (msg) => console.log(`  ok    ${msg}`);
const warn = (msg) => console.log(`  --    ${msg}`);
const bad = (msg) => {
  failed = true;
  console.log(`  FAIL  ${msg}`);
};
const version = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: env() });
  return r.status === 0 ? (r.stdout || r.stderr).split('\n')[0].trim() : null;
};

console.log(`Project: ${PROJECT}${existsSync(path.join(PROJECT, 'showpilot.config.ts')) ? '' : '  (no showpilot.config.ts here: run `showpilot init`)'}`);
console.log(`Outputs: ${OUT}`);
console.log(`Home:    ${HOME}  (browser, voice and caches; delete it to uninstall)\n`);

console.log('Tools:');
const [major] = process.versions.node.split('.').map(Number);
if (major >= 20) ok(`node ${process.versions.node}`);
else bad(`node ${process.versions.node}: Showpilot needs Node 20 or later`);
const ffmpeg = version('ffmpeg', ['-version']);
if (!ffmpeg) bad('ffmpeg not found on PATH (https://ffmpeg.org/download.html, or `brew install ffmpeg`)');
else {
  ok(ffmpeg);
  const rb = (spawnSync('ffmpeg', ['-hide_banner', '-h', 'filter=rubberband'], { encoding: 'utf8' }).stdout ?? '').includes('Filter rubberband');
  if (rb) ok('ffmpeg has Rubber Band (natural emphasis and pitch in the voice)');
  else warn('ffmpeg has no Rubber Band filter: emphasis and energy are skipped, dubbing uses atempo. A full ffmpeg build adds it.');
}

console.log('\nBrowser (for recording):');
const browsers = REDIRECTS.PLAYWRIGHT_BROWSERS_PATH;
const chromium = existsSync(browsers) && readdirSync(browsers).some((d) => d.startsWith('chromium'));
if (chromium) ok(`Chromium in ${browsers}`);
else bad('Chromium is not installed yet: run `showpilot setup-browser`');

console.log('\nVoice (optional, for narration):');
if (!existsSync(PYTHON)) warn('not set up: run `showpilot setup-voice` (silent cuts with subtitles work without it)');
else {
  const probe = 'import torch; d = "cuda" if torch.cuda.is_available() else "mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu"; print(torch.__version__, d, torch.cuda.get_device_name(0) if d == "cuda" else "")';
  const r = spawnSync(PYTHON, ['-c', probe], { env: env(), encoding: 'utf8' });
  if (r.status !== 0) bad(`voice environment: ${r.stderr.trim().split('\n').pop()}`);
  else {
    const [torch, device, ...gpu] = r.stdout.trim().split(' ');
    const where = { cuda: `the NVIDIA GPU (${gpu.join(' ')})`, mps: 'the Apple GPU', cpu: 'the CPU (slower, but fine)' }[device];
    ok(`torch ${torch}, speaking on ${where}`);
  }
  const whisper = spawnSync(PYTHON, ['-c', 'import faster_whisper'], { env: env() }).status === 0;
  if (whisper) ok('dictation ready (faster-whisper): showpilot dictate, and transcript-matched showpilot align');
  else warn('dictation not installed (optional): showpilot setup-voice --dictation');
}

console.log(failed ? '\nDoctor found problems (see FAIL above).' : '\nAll good.');
process.exit(failed ? 1 : 0);
