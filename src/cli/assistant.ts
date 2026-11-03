// showpilot assistant: installs (or updates) the guide your AI coding assistant follows to write and make videos:
// a Claude Code skill and a section in AGENTS.md (Cursor, Copilot, Codex and others).
import path from 'node:path';
import { installAssistantGuide } from '../guide/assistant';
import { PROJECT } from '../paths.mjs';

for (const f of installAssistantGuide(PROJECT)) console.log(`  wrote  ${path.relative(PROJECT, f)}`);
console.log('\nAsk your assistant, for example: "Make a 90-second energetic launch video of this app with Showpilot."');
console.log('It asks about anything the brief does not say (length, tone, narration, voice) before it writes the script.');
