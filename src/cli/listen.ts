// showpilot listen <cut>   (after showpilot voice <cut>; needs setup-voice --dictation)
// Listens back to the narration: every line is transcribed on this computer and compared with the script, and words
// the narrator said differently are listed, with the lexicon entries to add. Run voice again after fixing them.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCut } from '../config';
import { OUT, PYTHON, TMP, VOICE_DIR } from '../paths.mjs';
import { narratedLines } from '../recorder/script';
import { mishearings } from '../script/proof';

const cut = await loadCut(process.argv[2]);
const voiceFile = path.join(OUT, cut.id, 'voice', 'voice.json');
if (!existsSync(voiceFile)) throw new Error(`Generate the narration first: showpilot voice ${cut.id}`);
const voice = JSON.parse(readFileSync(voiceFile, 'utf8')) as Record<string, { file: string }>;
const lines = narratedLines(cut).filter((l) => voice[l.id]);

const input = path.join(TMP, `listen-${cut.id}.json`);
const output = path.join(TMP, `heard-${cut.id}.json`);
writeFileSync(input, JSON.stringify(lines.map((l) => ({ id: l.id, file: voice[l.id].file }))));
const r = spawnSync(PYTHON, [path.join(VOICE_DIR, 'listen.py'), input, output], { stdio: 'inherit', env: process.env });
if (r.status) {
  const installed = spawnSync(PYTHON, ['-c', 'import faster_whisper'], { env: process.env }).status === 0;
  console.error(installed ? 'Listening failed (see above).' : 'Listening needs the transcriber: run `showpilot setup-voice --dictation`.');
  process.exit(1);
}
const heard = JSON.parse(readFileSync(output, 'utf8')) as Record<string, string>;

const suspects = new Map<string, Set<string>>();
for (const l of lines) {
  const found = mishearings(l.say, heard[l.id] ?? '');
  if (!found.length) continue;
  console.log(`\n${l.id}  ${heard[l.id]}`);
  for (const m of found) {
    console.log(`  wrote "${m.wrote}", heard "${m.heard || '(nothing)'}"`);
    suspects.set(m.wrote, (suspects.get(m.wrote) ?? new Set()).add(m.heard));
  }
}
if (!suspects.size) console.log(`\nAll ${lines.length} lines were heard as written.`);
else {
  console.log(`\n${suspects.size} word${suspects.size > 1 ? 's' : ''} to check. Some are just the transcriber's spelling; listen to those lines.`);
  console.log('For words the narrator says wrongly, add how to say them to the lexicon file (config: lexicon), e.g.:');
  for (const w of suspects.keys()) console.log(`  ${JSON.stringify(w)}: "<how it is said, e.g. two words or a respelling>",`);
}
