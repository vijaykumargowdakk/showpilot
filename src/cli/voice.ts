// showpilot voice <cut>: speaks every line of a cut with the configured narrator (src/voice/tts.py).
// The Python process exits when it is done, which frees the GPU before recording or rendering starts.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fromProject, loadConfig, loadCut } from '../config';
import { OUT, PYTHON, VOICE_DIR } from '../paths.mjs';
import { narratedLines } from '../recorder/script';

const config = await loadConfig();
const cut = await loadCut(process.argv[2]);
if (!config.voice) throw new Error('No narrator set: add voice: { mix, speed } to showpilot.config.ts (pick one with `showpilot voices`).');

const beats = narratedLines(cut);
const dir = path.join(OUT, cut.id, 'voice');
mkdirSync(dir, { recursive: true });
const manifest = path.join(dir, 'manifest.json');
const lexicons = [path.join(VOICE_DIR, 'lexicon.json'), ...(config.lexicon ? [fromProject(config.lexicon)] : [])];
writeFileSync(manifest, JSON.stringify({ voice: config.voice, beats, cache: path.join(OUT, 'voice-cache'), lexicons }, null, 1));
console.log(`${cut.title}: ${beats.length} narrated lines`);
const r = spawnSync(PYTHON, [path.join(VOICE_DIR, 'tts.py'), manifest], { stdio: 'inherit', env: process.env });
if (r.error) console.error(r.error.message.includes('ENOENT') ? 'The voice is not set up yet: run `showpilot setup-voice`.' : r.error.message);
process.exit(r.status ?? 1);
