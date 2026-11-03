// Listening back: compare what the narrator was asked to say with what a transcriber hears, to find words it says
// wrongly (a product name read as one odd word, an acronym spelled out, a misplaced stress). Those go in the lexicon.
import { cleanText } from '../video/subtitles';

export type Mismatch = { wrote: string; heard: string };

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/**
 * Words of the script that were heard differently, from a word-level alignment (longest common subsequence). Runs of
 * unmatched words between two matches are reported together. Numbers are skipped: transcribers write them as digits
 * or words at random, and the narrator reads both the same way.
 */
export function mishearings(script: string, heard: string): Mismatch[] {
  const a = words(cleanText(script));
  const b = words(heard);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Mismatch[] = [];
  let i = 0;
  let j = 0;
  let wrote: string[] = [];
  let heardRun: string[] = [];
  const flush = () => {
    const w = wrote.filter((x) => !/\d/.test(x));
    // "codebase" heard as "code base" (or "show pilot" as "showpilot") was said right: only the spelling differs.
    const same = w.join('').replace(/'/g, '') === heardRun.join('').replace(/'/g, '');
    if (w.length && !same) out.push({ wrote: w.join(' '), heard: heardRun.join(' ') });
    wrote = [];
    heardRun = [];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i++;
      j++;
    } else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) heardRun.push(b[j++]);
    else wrote.push(a[i++]);
  }
  flush();
  return out;
}
