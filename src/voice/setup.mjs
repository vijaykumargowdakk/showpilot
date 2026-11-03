// showpilot setup-voice [--dictation]: creates the Python environment in SHOWPILOT_HOME, installs Kokoro and a torch build that fits
// this computer (CUDA with an NVIDIA GPU, the default build on macOS for Apple Silicon, the CPU build elsewhere), then
// downloads the model and voices. Every download goes into SHOWPILOT_HOME.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PYTHON, VENV, VOICE_DIR } from '../paths.mjs';

function run(cmd, args) {
  console.log(`\n> ${[cmd, ...args].join(' ')}`);
  return spawnSync(cmd, args, { stdio: 'inherit', env: process.env }).status === 0;
}
function must(cmd, args) {
  if (!run(cmd, args)) process.exit(1);
}

/** A Python 3.10–3.12 on PATH (Kokoro does not support newer versions yet); SHOWPILOT_PYTHON picks one explicitly. */
function findPython() {
  const names = process.env.SHOWPILOT_PYTHON ? [process.env.SHOWPILOT_PYTHON] : ['python3.12', 'python3.11', 'python3.10', 'python3', 'python'];
  for (const name of names) {
    const r = spawnSync(name, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
    const version = r.status === 0 ? r.stdout.trim() : '';
    if (['3.10', '3.11', '3.12'].includes(version)) return name;
    if (version) console.log(`  ${name} is Python ${version}; Kokoro needs 3.10, 3.11 or 3.12`);
  }
  console.error('No Python 3.10–3.12 found. Install one (python.org, or `brew install python@3.12` on macOS), or set SHOWPILOT_PYTHON.');
  process.exit(1);
}

const nvidia = process.platform !== 'darwin' && spawnSync('nvidia-smi', ['-L'], { encoding: 'utf8' }).status === 0;
const torchIndex = nvidia ? 'https://download.pytorch.org/whl/cu128' : process.platform === 'linux' ? 'https://download.pytorch.org/whl/cpu' : null;
console.log(nvidia ? 'NVIDIA GPU found: installing torch with CUDA.' : process.platform === 'darwin' ? 'macOS: installing torch (uses the Apple GPU when there is one).' : 'No NVIDIA GPU: installing the CPU build of torch.');

if (!existsSync(PYTHON)) must(findPython(), ['-m', 'venv', VENV]);
const pip = (...args) => must(PYTHON, ['-m', 'pip', 'install', '--retries', '10', '--timeout', '60', ...args]);

// --dictation adds local speech-to-text (faster-whisper) for `showpilot dictate` and `showpilot align`.
if (process.argv.includes('--dictation')) {
  pip('faster-whisper');
  console.log('\nDictation is ready: the speech model downloads into SHOWPILOT_HOME the first time it is used.');
  process.exit(0);
}
pip('--upgrade', 'pip');
pip('torch', ...(torchIndex ? ['--index-url', torchIndex] : []));
pip('-r', path.join(VOICE_DIR, 'requirements.txt'));
must(PYTHON, [path.join(VOICE_DIR, 'fetch_model.py')]);
console.log('\nThe voice is ready. Try `showpilot voices` to hear the narrators.');
