// The script you write yourself (cuts/<id>.script.md) and the cut it turns into.
//
//   # Title
//   ## Chapter title                 a recorded chapter of the app
//   ## [kinetic] Title               a scene: kinetic, badges or cta
//   ## [web https://…] Title         a recorded web page
//   A paragraph is one narration line (delivery marks allowed: | || *stress* <up>…</up>).
//   > do: click "Add task"           what happens on screen during the line above, in plain words
//
// `showpilot script` writes cuts/<id>.ts from it (regenerated every time) and adds a stub per `do:` note to
// cuts/<id>.actions.ts, the hand-written part, which it never changes. Notes are the keys, so editing the narration
// keeps every action.

export type ScriptLine = { say: string; notes: string[] };
export type ScriptChapter = { title: string; kind: 'app' | 'web' | 'scene'; scene?: 'kinetic' | 'badges' | 'cta'; url?: string; lines: ScriptLine[] };
export type Script = { title: string; chapters: ScriptChapter[] };

export function parseScript(md: string): Script {
  const script: Script = { title: '', chapters: [] };
  let chapter: ScriptChapter | undefined;
  let paragraph: string[] = [];
  const flush = () => {
    if (!paragraph.length) return;
    if (!chapter) throw new Error(`Narration before the first ## chapter: "${paragraph.join(' ').slice(0, 60)}"`);
    chapter.lines.push({ say: paragraph.join(' ').replace(/\s+/g, ' ').trim(), notes: [] });
    paragraph = [];
  };
  const text = md.replace(/<!--[\s\S]*?-->/g, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^#\s/.test(line)) {
      flush();
      script.title = line.slice(2).trim();
      continue;
    }
    const heading = /^##\s+(?:\[(kinetic|badges|cta|web)(?:\s+(\S+))?\]\s*)?(.*)$/.exec(line);
    if (heading) {
      flush();
      const [, tag, url, title] = heading;
      if (tag === 'web' && !url) throw new Error(`"## [web …]" needs a URL: ${line}`);
      chapter =
        tag === 'web' ? { title: title || url!, kind: 'web', url, lines: [] } : tag ? { title: title || tag, kind: 'scene', scene: tag as ScriptChapter['scene'], lines: [] } : { title, kind: 'app', lines: [] };
      script.chapters.push(chapter);
      continue;
    }
    const note = /^>\s*do\s*:\s*(.+)$/i.exec(line);
    if (note) {
      flush();
      const last = chapter?.lines.at(-1);
      if (!last) throw new Error(`A "> do:" note needs a narration line above it: ${line}`);
      last.notes.push(note[1].trim());
      continue;
    }
    paragraph.push(line);
  }
  flush();
  if (!script.title) throw new Error('The script needs a "# Title" line');
  return script;
}

/** The key an action is stored under: the note itself (several notes on one line are joined). */
export const actionKey = (line: ScriptLine) => line.notes.join(' · ');

export function cutSource(id: string, s: Script, opts: { silent: boolean; chapterTitles: boolean }): string {
  const q = (t: string) => JSON.stringify(t);
  const beatSource = (c: ScriptChapter, l: ScriptLine) => {
    if (c.kind === 'scene' || !l.notes.length) return `beat({ say: ${q(l.say)}${c.kind === 'scene' ? '' : ", camera: 'wide'"} })`;
    return `beat({ say: ${q(l.say)}, do: actions[${q(actionKey(l))}] })`;
  };
  const chapters = s.chapters.map((c) => {
    const beats = c.lines.map((l) => `      ${beatSource(c, l)},`).join('\n');
    if (c.kind === 'web') return `    web(${q(c.title)}, ${q(c.url!)}, [\n${beats}\n    ]),`;
    if (c.kind === 'app') return `    chapter(${q(c.title)}, [\n${beats}\n    ]),`;
    const props =
      c.scene === 'badges' ? `, {\n      // Add one badge per item, appearing when its word is said, e.g. { word: 'fast', title: 'Fast', sub: '…' }.\n      props: { badges: [] },\n    }` : '';
    return `    scene(${q(c.title)}, ${q(c.scene!)}, [\n${beats}\n    ]${props}),`;
  });
  const helpers = ['beat', 'chapter', 'cut', 'scene', 'web'].filter((h) => ['beat', 'cut'].includes(h) || s.chapters.some((c) => ({ chapter: 'app', scene: 'scene', web: 'web' })[h] === c.kind));
  const usesActions = s.chapters.some((c) => c.kind !== 'scene' && c.lines.some((l) => l.notes.length));
  return `// Generated from cuts/${id}.script.md by \`showpilot script ${id}\`: edit the script and run it again.
// The on-screen actions are in cuts/${id}.actions.ts, which is yours and is never overwritten.
import { ${helpers.join(', ')} } from 'showpilot';
${usesActions ? `import { actions } from './${id}.actions';\n` : ''}`.trimEnd() + `

export default cut({
  id: ${q(id)},
  title: ${q(s.title)},
  silent: ${opts.silent},
  chapterTitles: ${opts.chapterTitles},
  chapters: [
${chapters.join('\n')}
  ],
});
`;
}

export const ACTIONS_END = '  // showpilot:actions-end';

export function actionsSource(id: string): string {
  return `// The on-screen actions for cuts/${id}.ts, one per \`> do:\` note in cuts/${id}.script.md. This file is yours:
// \`showpilot script\` only adds stubs for new notes (above the end marker) and never changes what is here.
// Each action is Playwright through the Studio: s.click(), s.type(), s.press(), s.focus(), … (see Showpilot's docs).
import type { Studio } from 'showpilot';

export const actions: Record<string, (s: Studio) => Promise<void>> = {
${ACTIONS_END}
};
`;
}

/** Adds a stub for every note that has no action yet. Returns the new text and the keys that were added and unused. */
export function addActionStubs(existing: string, s: Script): { text: string; added: string[]; unused: string[] } {
  const keys = s.chapters.flatMap((c) => (c.kind === 'scene' ? [] : c.lines.filter((l) => l.notes.length).map(actionKey)));
  const unique = [...new Set(keys)];
  const has = (k: string) => existing.includes(`${JSON.stringify(k)}:`);
  const added = unique.filter((k) => !has(k));
  if (added.length && !existing.includes(ACTIONS_END)) throw new Error(`The actions file has no "${ACTIONS_END.trim()}" line to add new actions above`);
  const stubs = added.map((k) => `  ${JSON.stringify(k)}: async (s) => {\n    // TODO: ${k}\n    await s.wait(1);\n  },\n`).join('');
  const text = added.length ? existing.replace(ACTIONS_END, `${stubs}${ACTIONS_END}`) : existing;
  const unused = [...text.matchAll(/^ {2}("(?:[^"\\]|\\.)*"):\s*async/gm)].map((m) => JSON.parse(m[1]) as string).filter((k) => !unique.includes(k));
  return { text, added, unused };
}

export const scriptTemplate = (title: string) => `# ${title}

<!-- One paragraph per narration line. Under a line, "> do:" says what happens on screen while it is spoken.
     ## [kinetic], [badges] and [cta] are drawn scenes; ## [web https://…] records a web page.
     Then run: npx showpilot script <id> -->

## [kinetic] Hello
Meet *${title.split(/[:—-]/)[0].trim()}*. | It does the one thing you need, | beautifully.

## First look
This is where everything starts.
> do: move to the main screen and pause

Add your first item in one step.
> do: click the add button and type a name

## [cta] Thanks
Try it today. || Thanks for watching!
`;
