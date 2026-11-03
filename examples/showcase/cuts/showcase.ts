// Showpilot's own showcase (about 75 s, narrated): what it does, shown by doing it, on the example app.
// npx showpilot voice showcase && npx showpilot record showcase && npx showpilot render showcase
import { beat, chapter, cut, scene, web, type Studio } from 'showpilot';
import { REPO } from '../showpilot.config';

const task = (s: Studio, title: string) => s.page.getByRole('checkbox', { name: `Done: ${title}` });

/** Behind the opening words: the app being used, in a tilted window. */
async function broll(s: Studio) {
  await s.wait(0.6);
  await s.type(s.page.getByLabel('New task'), 'Make the launch video');
  await s.press('Enter');
  await s.wait(0.8);
  await s.click(task(s, 'Plan the next sprint'));
  await s.wait(0.8);
  await s.click(s.page.getByRole('button', { name: 'Done', exact: true }));
}

export default cut({
  id: 'showcase',
  title: 'Showpilot: product videos, written instead of edited',
  chapters: [
    scene(
      'Written, not edited',
      'kinetic',
      [
        beat({ say: 'This video was not recorded by hand. || And nobody edited it.' }),
        beat({ say: '<up>It was *written*.</up> || A short script, | and *Showpilot* did the rest.' }),
      ],
      { broll, props: { highlight: ['written', 'script'] } },
    ),

    chapter('It drives your real app', [
      beat({
        say: 'Showpilot opens your real app, | and drives it like a person: | smooth mouse moves, | and typing at human speed.',
        do: async (s) => s.type(s.page.getByLabel('New task'), 'Ship the new onboarding'),
      }),
      beat({
        say: 'A camera follows the action, | zooming in on every click, | and easing out when things go quiet.',
        do: async (s) => {
          await s.click(task(s, 'Write the launch post'), 'Done');
          await s.wait(0.8);
          await s.focus(s.page.getByRole('complementary', { name: 'Progress' }), 1.6);
        },
      }),
      beat({
        say: 'Keys show up as keycaps, | and callouts point at what matters.',
        do: async (s) => {
          await s.click(s.page.getByLabel('New task'));
          await s.press('Enter');
          await s.wait(0.4);
          await s.callout(s.page.getByRole('complementary', { name: 'Progress' }), 'Updates as you work');
          await s.focus(s.page.getByRole('complementary', { name: 'Progress' }), 1.5);
        },
      }),
    ]),

    scene(
      'Everything a launch needs',
      'badges',
      [beat({ say: "There's a *narrator* that runs on your own computer. | *Subtitles* for every line. | And *thumbnails* and chapters, | from the same script." })],
      {
        props: {
          badges: [
            { word: 'narrator', title: 'A natural narrator', sub: 'Kokoro voices, on your own GPU or CPU' },
            { word: 'subtitles', title: 'Subtitles', sub: '.srt, a timed script, and chapters' },
            { word: 'thumbnails', title: 'Thumbnails', sub: 'From any moment of the recording' },
          ],
          tagline: { text: 'No screen recorder · No timeline · No microphone', after: 'script' },
        },
      },
    ),

    web('The script', `${REPO}/blob/main/examples/hello/cuts/tour.ts`, [
      beat({
        say: "Here's a whole video's script: | a few dozen lines of TypeScript.",
        camera: 'wide',
        do: async (s) => {
          await s.moveTo({ x: 1100, y: 600 });
          await s.scroll(500, 2.5);
        },
      }),
      beat({
        say: 'Change your app, | run it again, | and the video is *re-shot*. || In one command.',
        camera: 'wide',
        do: async (s) => s.scroll(600, 3),
      }),
    ]),

    scene('Make yours', 'cta', [beat({ say: "That's *Showpilot*. | Free, | open source, | and ready for your app. || <up>Go make something great.</up>", hold: 1.2 })], {
      props: { line: 'Product videos, written instead of edited.' },
    }),
  ],
  thumbnail: {
    chapter: 2,
    at: 7,
    crop: { x: 40, y: 100, width: 1300, height: 700 },
    headlines: [{ lines: ['Demo videos', 'that film', 'themselves.'], accentFrom: 1 }],
    chips: ['Auto-zoom', 'AI narrator', 'Subtitles'],
  },
});
