// A video's brief (cuts/<id>.brief.md): what the video is for, how long and in what tone, who narrates it and who
// writes the script. `showpilot new` writes it; your AI assistant, `showpilot script` and `showpilot check` read it.
// The file is Markdown with a small front-matter block, so people can edit it by hand.

export const TONES = {
  energetic: { energy: 1.0, speed: 1.0, line: "Hi! | This is how I'd sound, walking people through your product. || <up>Fast, bright, and full of energy!</up>" },
  professional: { energy: 0.4, speed: 0.95, line: 'Hello. | This is how I would present your product: | clear, | confident, | and to the point.' },
  friendly: { energy: 0.7, speed: 0.97, line: "Hey there! | I'd love to show people around your product. || Warm, | relaxed, | easy to follow." },
  calm: { energy: 0.15, speed: 0.9, line: 'Welcome. | Let me take you through it, | one step at a time. || Calm, | and unhurried.' },
  playful: { energy: 1.0, speed: 1.03, line: "Okay, | ready? || Let's have some fun with your product. | <up>Quick, | light, | and a little cheeky!</up>" },
} as const;
export type Tone = keyof typeof TONES;

export const PURPOSES = ['launch', 'walkthrough', 'tutorial', 'update'] as const;
export type Purpose = (typeof PURPOSES)[number];

/** Suggested lengths, in seconds. */
export const LENGTHS = { teaser: 75, short: 150, demo: 330, 'deep dive': 750 } as const;

export const NARRATIONS = ['ai', 'own', 'silent'] as const;
export type Narration = (typeof NARRATIONS)[number];
export const AUTHORS = ['assistant', 'self', 'dictate'] as const;
export type Author = (typeof AUTHORS)[number];

export type Brief = {
  id: string;
  title: string;
  purpose: Purpose;
  audience: string;
  /** Target length in seconds. */
  length: number;
  tone: Tone;
  /** ai: a Kokoro narrator; own: you record yourself reading the script; silent: subtitles only. */
  narration: Narration;
  /** assistant: your AI coding assistant writes the cut; self: you write cuts/<id>.script.md; dictate: you speak it. */
  author: Author;
  /** Free text: what the video should show and the one thing viewers should remember. */
  goals: string;
};

/** "90", "90s", "2m", "2:30", "2.5 min" → seconds. */
export function parseLength(text: string): number {
  const t = text.trim().toLowerCase();
  const named = LENGTHS[t as keyof typeof LENGTHS];
  if (named) return named;
  const clock = /^(\d+):(\d{1,2})$/.exec(t);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const m = /^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/.exec(t);
  if (!m) throw new Error(`Not a length: "${text}" (try 90s, 2m, 2:30)`);
  return Math.round(Number(m[1]) * (m[2]?.startsWith('m') ? 60 : 1));
}

export const formatLength = (seconds: number) =>
  seconds < 120 ? `${seconds} s` : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ''}`;

export function writeBrief(b: Brief): string {
  return `---
id: ${b.id}
title: ${b.title}
purpose: ${b.purpose}
audience: ${b.audience}
length: ${b.length}
tone: ${b.tone}
narration: ${b.narration}
author: ${b.author}
---

# ${b.title}

${/^[aeiou]/.test(b.purpose) ? 'An' : 'A'} ${b.purpose} video for ${b.audience}, about ${formatLength(b.length)} long, in ${/^[aeiou]/.test(b.tone) ? 'an' : 'a'} ${b.tone} tone.
${{ ai: 'Narrated by the AI voice in showpilot.config.ts.', own: 'Narrated by me: render it silent, then I record myself reading the script (`showpilot align`).', silent: 'Silent, with subtitles.' }[b.narration]}
${{ assistant: 'The script is written by my AI coding assistant (see AGENTS.md or the Showpilot skill).', self: `I write the script in cuts/${b.id}.script.md.`, dictate: `I dictate the script (\`showpilot dictate ${b.id}\`).` }[b.author]}

## What it should show

${b.goals.trim() || '- The problem the product solves, in one line\n- The two or three moments that make people want it\n- Where to try it'}
`;
}

export function readBrief(text: string): Brief {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('A brief starts with a --- front-matter block');
  const fields = Object.fromEntries(
    m[1].split(/\r?\n/).flatMap((l) => {
      const at = l.indexOf(':');
      return at > 0 ? [[l.slice(0, at).trim(), l.slice(at + 1).trim()]] : [];
    }),
  );
  const pick = <T extends string>(value: string, allowed: readonly T[], name: string): T => {
    if (!allowed.includes(value as T)) throw new Error(`brief: ${name} must be one of ${allowed.join(', ')} (got "${value}")`);
    return value as T;
  };
  const goals = /## What it should show\s*\n([\s\S]*)$/.exec(m[2])?.[1].trim() ?? '';
  return {
    id: fields.id,
    title: fields.title ?? fields.id,
    purpose: pick(fields.purpose ?? 'launch', PURPOSES, 'purpose'),
    audience: fields.audience ?? 'new users',
    length: parseLength(fields.length ?? '90'),
    tone: pick(fields.tone ?? 'friendly', Object.keys(TONES) as Tone[], 'tone'),
    narration: pick(fields.narration ?? 'ai', NARRATIONS, 'narration'),
    author: pick(fields.author ?? 'assistant', AUTHORS, 'author'),
    goals,
  };
}
