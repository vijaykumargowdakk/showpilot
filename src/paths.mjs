// Where Showpilot keeps things.
//
// SHOWPILOT_HOME (default ~/.showpilot) holds the heavy, shared files: the Python environment and Kokoro model for
// the voice, the browser Playwright drives, and every download cache and temp file the tools make. Deleting that one
// folder uninstalls all of it. A project's own outputs (recordings, narration, renders) go to <project>/out.
//
// The CLI sets SHOWPILOT_PROJECT before running a command; REDIRECTS points each tool's default cache into HOME.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT = path.resolve(process.env.SHOWPILOT_PROJECT ?? process.cwd());
export const HOME = path.resolve(process.env.SHOWPILOT_HOME ?? path.join(os.homedir(), '.showpilot'));
export const CACHE = path.join(HOME, 'cache');
export const TMP = path.join(CACHE, 'tmp');
/** The voice's Python environment; SHOWPILOT_VENV reuses an existing one that already has Kokoro and torch. */
export const VENV = path.resolve(process.env.SHOWPILOT_VENV ?? path.join(HOME, 'venv'));
export const PYTHON = process.platform === 'win32' ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
export const OUT = path.join(PROJECT, 'out');
export const VOICE_DIR = path.join(PKG, 'src', 'voice');

/** Environment variables that move every tool's default cache location into SHOWPILOT_HOME. */
export const REDIRECTS = {
  npm_config_cache: path.join(CACHE, 'npm'),
  PLAYWRIGHT_BROWSERS_PATH: path.join(CACHE, 'ms-playwright'),
  PIP_CACHE_DIR: path.join(CACHE, 'pip'),
  HF_HOME: path.join(CACHE, 'huggingface'),
  TORCH_HOME: path.join(CACHE, 'torch'),
  CUDA_CACHE_PATH: path.join(CACHE, 'cuda'),
  XDG_CACHE_HOME: CACHE,
  SPACY_DATA: path.join(CACHE, 'spacy'),
  TEMP: TMP,
  TMP,
  TMPDIR: TMP,
  PYTHONUTF8: '1',
  HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
};

export function env() {
  return { ...process.env, ...REDIRECTS, SHOWPILOT_PROJECT: PROJECT, SHOWPILOT_HOME: HOME };
}
