// Puts the Showpilot guide where AI coding assistants find it: a Claude Code skill (.claude/skills/showpilot/SKILL.md)
// and a marked section in AGENTS.md, which Cursor, Copilot, Codex and others read. Text outside the markers is the
// user's and is kept.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PKG } from '../paths.mjs';

const START = '<!-- showpilot:start';
const END = '<!-- showpilot:end -->';

/** AGENTS.md with the Showpilot section added, or replaced if it is already there. */
export function withSection(agents: string, section: string): string {
  const a = agents.indexOf(START);
  const b = agents.indexOf(END);
  if (a !== -1 && b > a) return agents.slice(0, a) + section.trim() + agents.slice(b + END.length);
  return `${agents.trimEnd()}${agents.trim() ? '\n\n' : ''}${section.trim()}\n`;
}

export function installAssistantGuide(project: string): string[] {
  const templates = path.join(PKG, 'src', 'templates');
  const skill = path.join(project, '.claude', 'skills', 'showpilot', 'SKILL.md');
  mkdirSync(path.dirname(skill), { recursive: true });
  writeFileSync(skill, readFileSync(path.join(templates, 'skill.md'), 'utf8'));
  const agents = path.join(project, 'AGENTS.md');
  const before = existsSync(agents) ? readFileSync(agents, 'utf8') : '';
  writeFileSync(agents, withSection(before, readFileSync(path.join(templates, 'agents.md'), 'utf8')));
  return [skill, agents];
}
