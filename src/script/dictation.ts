// A dictated video: the words of a recording (with their times, from the local transcriber) turned into a script
// (cuts/<id>.script.md). Sentences become narration lines. Saying "next chapter" (or "new chapter"), or pausing
// for more than 2.5 s, starts a new chapter. The first chapter opens as a kinetic scene; the rest are app chapters
// to fill in with "> do:" notes, and their headings can be edited afterwards.

export type Word = { w: string; start: number; end: number };

const CHAPTER_CUE = /^(next|new)\s+chapter[.,!?]?$/i;
const PAUSE = 2.5;

export function dictationToScript(title: string, words: Word[]): string {
  type Sentence = { text: string; start: number; end: number; newChapter: boolean };
  const sentences: Sentence[] = [];
  let current: Word[] = [];
  let breakNext = false;
  const close = () => {
    if (!current.length) return;
    // Whisper's words carry their own leading spaces (and word pieces have none), so they join as they are.
    const raw = current.some((w) => /^\s/.test(w.w)) ? current.map((w) => w.w).join('') : current.map((w) => w.w).join(' ');
    const text = raw.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
    sentences.push({ text: text.charAt(0).toUpperCase() + text.slice(1), start: current[0].start, end: current.at(-1)!.end, newChapter: breakNext });
    breakNext = false;
    current = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const pair = `${w.w.trim()} ${words[i + 1]?.w.trim() ?? ''}`.trim();
    if (CHAPTER_CUE.test(pair)) {
      close();
      breakNext = true;
      i++;
      continue;
    }
    const prev = current.at(-1) ?? (sentences.length ? { end: sentences.at(-1)!.end } : null);
    if (prev && w.start - prev.end > PAUSE) {
      close();
      if (sentences.length) breakNext = true;
    }
    current.push(w);
    if (/[.!?]["')\]]?$/.test(w.w.trim())) close();
  }
  close();

  const chapters: string[][] = [];
  for (const s of sentences) {
    if (!chapters.length || s.newChapter) chapters.push([]);
    chapters.at(-1)!.push(s.text);
  }
  const body = chapters
    .map((lines, i) => {
      const heading = i === 0 ? '## [kinetic] Opening' : `## Part ${i}`;
      // A hint, as a comment, so it becomes a real note (and an action stub) only once it's written.
      const notes = i === 0 ? '' : '\n<!-- > do: what happens on screen during this line -->';
      return `${heading}\n${lines.map((l, k) => (k === 0 ? `${l}${notes}` : l)).join('\n\n')}`;
    })
    .join('\n\n');
  return `# ${title}

<!-- Dictated. Each paragraph is a narration line; edit freely. Rename the "## Part" headings, add "> do:" notes
     under lines to say what happens on screen, then run: npx showpilot script <id> -->

${body}
`;
}
