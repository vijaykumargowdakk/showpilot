import { describe, expect, it } from 'vitest';
import { dictationToScript, type Word } from './dictation';
import { parseScript } from './markdown';

/** Words of a sentence, one every 0.3 s from `at`. */
const say = (text: string, at: number): Word[] => text.split(' ').map((w, i) => ({ w, start: at + i * 0.3, end: at + i * 0.3 + 0.25 }));

describe('dictation', () => {
  it('makes sentences into lines and starts chapters on "next chapter" or a long pause', () => {
    const words = [
      ...say('Meet Taskly. Your to-dos, finally under control.', 0),
      ...say('Next chapter.', 4),
      ...say('Type a task and press Enter.', 5),
      ...say('Tick it when it is done.', 7.2),
      ...say('That is all. Thanks for watching!', 13), // after a pause of more than 2.5 s
    ];
    const md = dictationToScript('Taskly: dictated', words);
    expect(md).not.toMatch(/next chapter/i);
    const s = parseScript(md);
    expect(s.title).toBe('Taskly: dictated');
    expect(s.chapters.map((c) => [c.kind, c.scene ?? '', c.lines.length])).toEqual([
      ['scene', 'kinetic', 2],
      ['app', '', 2],
      ['app', '', 2],
    ]);
    expect(s.chapters[1].lines[0].say).toBe('Type a task and press Enter.');
    expect(s.chapters[1].lines[0].notes).toEqual([]); // the hint is a comment until it's written
    expect(md).toContain('<!-- > do:');
  });

  it('still makes a script from a single breathless sentence, capitalised', () => {
    const s = parseScript(dictationToScript('One', say('this has no full stop at all', 0)));
    expect(s.chapters[0].lines[0].say).toBe('This has no full stop at all');
  });

  it("joins Whisper's words, which carry their own spaces, as they are", () => {
    const words = [' Your', ' to', '-dos', ' are', ' done.'].map((w, i) => ({ w, start: i * 0.3, end: i * 0.3 + 0.2 }));
    expect(parseScript(dictationToScript('W', words)).chapters[0].lines[0].say).toBe('Your to-dos are done.');
  });
});
