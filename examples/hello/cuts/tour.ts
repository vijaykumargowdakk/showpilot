// A one-minute tour of the example app. Silent: each line stays up for as long as it takes to read, and the lines go
// to out/tour/tour.srt. Try: showpilot record tour, then showpilot render tour.
import { beat, chapter, cut, scene, type Studio } from 'showpilot';

/** Plays behind the opening words: the app in use, in a tilted window. */
async function broll(s: Studio) {
  await s.wait(0.3);
  await s.type(s.page.getByLabel('New task'), 'Ship the demo video');
  await s.press('Enter');
  await s.wait(0.6);
  await s.click(s.page.getByRole('checkbox', { name: 'Done: Plan the next sprint' }));
}

export default cut({
  id: 'tour',
  title: 'Taskly: a quick tour',
  silent: true,
  chapterTitles: true,
  chapters: [
    scene('Meet Taskly', 'kinetic', [beat({ say: 'Meet *Taskly*. | Your to-dos, | finally under control.' })], { broll, props: { highlight: ['control'] } }),

    chapter('Adding tasks', [
      beat({
        say: 'Type what needs doing, | and press Enter to add it to the list.',
        do: async (s) => {
          await s.type(s.page.getByLabel('New task'), 'Record the launch video');
          await s.press('Enter');
        },
      }),
      beat({
        say: 'Tick a task when it is done, | and the progress bar keeps up.',
        do: async (s) => {
          await s.click(s.page.getByRole('checkbox', { name: 'Done: Write the launch post' }), 'Done');
          await s.wait(0.6);
          await s.focus(s.page.getByRole('complementary', { name: 'Progress' }), 1.6);
        },
      }),
    ]),

    chapter('Filters', [
      beat({
        say: 'Filters show what is still open, | what is already done, | or everything.',
        do: async (s) => {
          for (const name of ['Open', 'Done', 'All']) {
            await s.click(s.page.getByRole('button', { name, exact: true }), name);
            await s.wait(0.8);
          }
        },
      }),
    ]),

    scene(
      'Why Taskly',
      'badges',
      [beat({ say: 'Fast to use. | Simple to learn. | And it keeps your work in the browser.' })],
      {
        props: {
          badges: [
            { word: 'fast', title: 'Fast', sub: 'Add a task in one keystroke' },
            { word: 'simple', title: 'Simple', sub: 'Nothing to learn' },
          ],
          tagline: { text: 'Your work stays in your browser', after: 'browser' },
        },
      },
    ),

    scene('Thanks', 'cta', [beat({ say: 'That was Taskly. | Thanks for watching!' })], { props: { line: 'A fictional example app' } }),
  ],
  thumbnail: {
    chapter: 2,
    at: 5,
    crop: { x: 40, y: 100, width: 1300, height: 700 },
    headlines: [{ lines: ['Your to-dos,', 'finally', 'under control.'], accentFrom: 1 }],
    chips: ['Fast', 'Simple'],
  },
});
