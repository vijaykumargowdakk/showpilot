// showpilot dictate <id> [recording] [--record] [--model small.en] [--language en] [--force]
// Turns a talk-through of the video into its script: record it here (--record, until Enter) or pass any audio file;
// it is transcribed on this computer (faster-whisper) and written to cuts/<id>.script.md, ready for `showpilot script`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readBrief } from '../guide/brief';
import { OUT, PROJECT, PYTHON, VOICE_DIR } from '../paths.mjs';
import { dictationToScript, type Word } from '../script/dictation';
import { recordMic } from './mic';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const [id, given] = args.filter((a, i) => !a.startsWith('--') && !['--model', '--language'].includes(args[i - 1]));
if (!id) throw new Error('Usage: showpilot dictate <id> [recording] [--record]');

const dir = path.join(OUT, id, 'dictation');
mkdirSync(dir, { recursive: true });
let audio = given ? path.resolve(given) : '';
if (!audio) {
  if (!args.includes('--record')) throw new Error('Pass a recording (any audio file), or --record to record from the microphone now.');
  audio = path.join(dir, `take-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`);
  await recordMic(audio);
}
if (!existsSync(audio)) throw new Error(`No such recording: ${audio}`);

const json = path.join(dir, 'transcript.json');
const r = spawnSync(PYTHON, [path.join(VOICE_DIR, 'transcribe.py'), audio, json, opt('--model') ?? 'small.en', opt('--language') ?? ''], { stdio: 'inherit', env: process.env });
if (r.error || r.status) {
  const installed = spawnSync(PYTHON, ['-c', 'import faster_whisper'], { env: process.env }).status === 0;
  console.error(installed ? 'Transcription failed (see above).' : 'Transcription needs the dictation add-on: run `showpilot setup-voice --dictation` (after `showpilot setup-voice`).');
  process.exit(1);
}
const words = (JSON.parse(readFileSync(json, 'utf8')) as { words: Word[] }).words;
if (!words.length) throw new Error('No speech found in the recording.');

const briefFile = path.join(PROJECT, 'cuts', `${id}.brief.md`);
const title = existsSync(briefFile) ? readBrief(readFileSync(briefFile, 'utf8')).title : id;
const target = path.join(PROJECT, 'cuts', existsSync(path.join(PROJECT, 'cuts', `${id}.script.md`)) && !args.includes('--force') ? `${id}.dictated.script.md` : `${id}.script.md`);
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, dictationToScript(title, words));
console.log(`→ ${path.relative(PROJECT, target)} (${words.length} words)`);
if (target.endsWith('.dictated.script.md')) console.log(`  cuts/${id}.script.md already exists, so it was kept; merge the two, or run again with --force to replace it.`);
console.log(`\nNext: read it through, rename the "## Part" headings, add "> do:" notes, then npx showpilot script ${id}`);
