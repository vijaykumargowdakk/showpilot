// Writes the chosen narrator into a project's showpilot.config.ts, keeping everything else as the user wrote it.
// Order of attempts: the line after a `// showpilot:voice` marker, an existing `voice: { … }` entry, a new entry
// right after `defineConfig({`. If none applies, the caller prints the snippet instead.

export type VoiceChoice = { mix: Record<string, number>; speed: number; energy: number };

export const voiceLine = (v: VoiceChoice, indent = '  ') =>
  `${indent}voice: { mix: { ${Object.entries(v.mix)
    .map(([k, w]) => `${k}: ${w}`)
    .join(', ')} }, speed: ${v.speed}, energy: ${v.energy} },`;

/** The config text with the voice set, or null when there is no safe place to put it. */
export function setVoice(config: string, v: VoiceChoice): string | null {
  const lines = config.split('\n');
  const marker = lines.findIndex((l) => l.includes('showpilot:voice'));
  if (marker !== -1 && marker + 1 < lines.length) {
    const indent = /^\s*/.exec(lines[marker])![0];
    // The marker's own line stays; the line after it is the voice (or a commented-out placeholder).
    if (/^\s*(\/\/\s*)?voice\s*:/.test(lines[marker + 1])) lines[marker + 1] = voiceLine(v, indent);
    else lines.splice(marker + 1, 0, voiceLine(v, indent));
    return lines.join('\n');
  }
  // voice: { mix: { … }, speed: …, energy: … } with one level of nested braces.
  const existing = /^(\s*)voice\s*:\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*,?\s*$/m;
  if (existing.test(config)) return config.replace(existing, (_, indent: string) => voiceLine(v, indent));
  const open = /defineConfig\(\s*\{[^\S\n]*\n/.exec(config);
  if (open) return config.slice(0, open.index + open[0].length) + voiceLine(v) + '\n' + config.slice(open.index + open[0].length);
  return null;
}
