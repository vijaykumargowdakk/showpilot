// showpilot script <id>: turns the script you wrote (cuts/<id>.script.md) into the cut (cuts/<id>.ts, regenerated
// each time) and adds a stub to cuts/<id>.actions.ts for every new "> do:" note. Your actions are never changed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readBrief } from '../guide/brief';
import { PROJECT } from '../paths.mjs';
import { actionsSource, addActionStubs, cutSource, parseScript } from '../script/markdown';

const id = process.argv[2];
if (!id) throw new Error('Usage: showpilot script <id>   (reads cuts/<id>.script.md)');
const dir = path.join(PROJECT, 'cuts');
const scriptFile = path.join(dir, `${id}.script.md`);
if (!existsSync(scriptFile)) throw new Error(`No cuts/${id}.script.md yet: run \`showpilot new ${id} --script self\`, or write one (see docs/writing-cuts.md).`);
const script = parseScript(readFileSync(scriptFile, 'utf8'));
const briefFile = path.join(dir, `${id}.brief.md`);
const brief = existsSync(briefFile) ? readBrief(readFileSync(briefFile, 'utf8')) : null;
// Only the AI voice narrates the render itself; your own voice is aligned onto the silent render afterwards.
const silent = brief ? brief.narration !== 'ai' : false;

writeFileSync(path.join(dir, `${id}.ts`), cutSource(id, script, { silent, chapterTitles: (brief?.length ?? 0) >= 300 }));
const actionsFile = path.join(dir, `${id}.actions.ts`);
const { text, added, unused } = addActionStubs(existsSync(actionsFile) ? readFileSync(actionsFile, 'utf8') : actionsSource(id), script);
writeFileSync(actionsFile, text);

const lines = script.chapters.reduce((n, c) => n + c.lines.length, 0);
console.log(`cuts/${id}.ts: ${script.chapters.length} chapters, ${lines} lines${silent ? ', silent' : ''}`);
console.log(`cuts/${id}.actions.ts: ${added.length ? `${added.length} new action stub${added.length > 1 ? 's' : ''} to fill in` : 'nothing new'}`);
for (const k of added) console.log(`  + ${k}`);
for (const k of unused) console.log(`  ! no note uses "${k}" any more; delete it if you no longer need it`);
console.log(`\nNext: fill in the stubs (or ask your AI assistant to), then npx showpilot check ${id}`);
