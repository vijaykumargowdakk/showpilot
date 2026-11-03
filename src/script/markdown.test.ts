import { describe, expect, it } from 'vitest';
import { actionsSource, addActionStubs, cutSource, parseScript, scriptTemplate } from './markdown';

const md = `# Taskly: a quick tour

<!-- a comment that is ignored -->

## [kinetic] Hello
Meet *Taskly*. | Your to-dos,
finally under control.

## Adding tasks
Type what needs doing, | and press Enter.
> do: type "Ship it" into New task and press Enter

Tick a task when it's done.
> do: tick "Write the launch post"
> do: focus the progress panel

Nothing happens on screen here.

## [web https://github.com/acme/taskly] The code
Here's the repository.

## [cta]
Thanks for watching!
`;

describe('script.md', () => {
  it('reads chapters, scenes, web pages, lines and notes', () => {
    const s = parseScript(md);
    expect(s.title).toBe('Taskly: a quick tour');
    expect(s.chapters.map((c) => [c.kind, c.scene ?? c.url ?? '', c.title])).toEqual([
      ['scene', 'kinetic', 'Hello'],
      ['app', '', 'Adding tasks'],
      ['web', 'https://github.com/acme/taskly', 'The code'],
      ['scene', 'cta', 'cta'],
    ]);
    expect(s.chapters[0].lines[0].say).toBe('Meet *Taskly*. | Your to-dos, finally under control.');
    expect(s.chapters[1].lines.map((l) => l.notes)).toEqual([['type "Ship it" into New task and press Enter'], ['tick "Write the launch post"', 'focus the progress panel'], []]);
  });

  it('says where the script is wrong', () => {
    expect(() => parseScript('## A\nline')).toThrow(/# Title/);
    expect(() => parseScript('# T\nA line before any chapter')).toThrow(/before the first/);
    expect(() => parseScript('# T\n## A\n> do: click')).toThrow(/narration line above/);
    expect(() => parseScript('# T\n## [web] Site\nHi')).toThrow(/needs a URL/);
  });

  it('turns into a cut that uses the actions by their notes', () => {
    const src = cutSource('tour', parseScript(md), { silent: true, chapterTitles: false });
    expect(src).toContain('silent: true,');
    expect(src).toContain(`scene("Hello", "kinetic", [\n      beat({ say: "Meet *Taskly*. | Your to-dos, finally under control." }),`);
    expect(src).toContain(`beat({ say: "Type what needs doing, | and press Enter.", do: actions["type \\"Ship it\\" into New task and press Enter"] }),`);
    expect(src).toContain(`do: actions["tick \\"Write the launch post\\" · focus the progress panel"]`);
    expect(src).toContain(`beat({ say: "Nothing happens on screen here.", camera: 'wide' }),`);
    expect(src).toContain(`web("The code", "https://github.com/acme/taskly", [`);
  });

  it('adds stubs only for new notes, keeps what is written, and lists actions no note uses', () => {
    const first = addActionStubs(actionsSource('tour'), parseScript(md));
    expect(first.added).toHaveLength(2);
    const written = first.text.replace('// TODO: tick "Write the launch post" · focus the progress panel\n    await s.wait(1);', 'await s.click(s.page.getByRole("checkbox"));');
    const edited = md.replace('> do: tick "Write the launch post"\n> do: focus the progress panel', '> do: tick "Write the launch post"\n> do: focus the progress panel\n\nOne more line.\n> do: open the filters');
    const second = addActionStubs(written, parseScript(edited.replace('Type what needs doing', 'Type anything')));
    expect(second.added).toEqual(['open the filters']);
    expect(second.text).toContain('await s.click(s.page.getByRole("checkbox"));');
    expect(second.unused).toEqual([]);
    expect(addActionStubs(second.text, parseScript(md.replace('> do: type "Ship it" into New task and press Enter\n', ''))).unused).toEqual([
      'type "Ship it" into New task and press Enter',
      'open the filters',
    ]);
  });

  it('starts people off with a template that parses', () => {
    const s = parseScript(scriptTemplate('Acme: the tour'));
    expect(s.chapters).toHaveLength(3);
    expect(s.chapters[0].lines[0].say).toContain('*Acme*');
  });
});
