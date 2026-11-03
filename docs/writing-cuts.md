# Writing cuts

A **cut** is one video: a list of **chapters**, each a list of **beats**. Cuts live in `cuts/<id>.ts` and export
`cut({ … })` as the default.

```ts
import { beat, chapter, cut, scene, web } from 'showpilot';

export default cut({
  id: 'tour',              // the file name: cuts/tour.ts
  title: 'Taskly: a quick tour',
  silent: false,           // true: no voice, paced for reading, with an .srt
  chapterTitles: false,    // true: a numbered title at the start of each recorded chapter
  chapters: [ /* … */ ],
  thumbnail: { /* … */ },  // optional, for `showpilot thumbnail`
});
```

## Beats

```ts
beat({
  say: 'Tick a task, | and the progress bar keeps up.',
  do: async (s) => {
    await s.click(s.page.getByRole('checkbox', { name: 'Done: Write the post' }), 'Done');
    await s.focus(s.page.getByRole('complementary', { name: 'Progress' }), 1.6);
  },
  camera: 'auto', // or 'wide', or { focus: box, scale: 1.6 }
  hold: 0.35,     // seconds held after the line
  lead: 0.3,      // seconds between the line starting and the actions starting
});
```

The recorder starts the line, waits `lead`, runs `do`, then holds until the line (plus `hold`) has finished. If the
actions take longer than the line, it says so, and the beat simply lasts longer. In silent cuts a line lasts as long
as it takes to read (2.2 words a second, at least 3 s).

`speak` sets different words for the narrator than the subtitles show, for example when a silent cut written to be
read is later dubbed (see [voice](voice.md#dubbing)).

## Chapters

| Helper | |
|---|---|
| `chapter(title, beats, setup?, { offline? })` | Records the app. `setup` runs before the take starts and is not filmed. `offline: true` lets the app's service worker run, so offline behaviour can be shown. |
| `web(title, url, beats, setup?)` | Records another site, such as your GitHub repository. |
| `scene(title, kind, beats, { props?, broll?, setup? })` | Drawn by the renderer, not recorded (see below). |

A chapter can also have `speed: 5`: its beats are acted, not narrated, and the take plays five times faster with a
timer badge. `voiceover` sets one line spoken over the whole sped-up chapter.

Every chapter is recorded in a fresh browser, so chapters don't depend on each other. Re-shoot one with
`showpilot record <cut> --chapter N`.

## The Studio: actions in `do`

`s.page` is the Playwright page, so any locator works. The Studio's own actions move a visible cursor and tell the
camera what is happening:

| Action | |
|---|---|
| `s.click(locator, label?)` | Glides to the element and clicks it, with a ripple. The camera zooms in. |
| `s.type(locator, text)` | Clicks a field, selects what is there and types at a human pace. |
| `s.press('Control+K')` | Presses keys and shows them as keycaps. |
| `s.hover(locator, seconds?)` | Moves onto an element and rests there. |
| `s.moveTo({ x, y }, seconds?)` | Moves the cursor (app pixels, 1920×1080). |
| `s.focus(locator \| box, scale?)` | Frames something without clicking it. |
| `s.wide()` | Zooms out to the whole window. |
| `s.callout(locator, text)` | Pins a label next to an element until the next beat. |
| `s.drag(from, to, seconds?)` | Drags with the real mouse (moving items, panning). |
| `s.dragAndDrop(locator, to)` | HTML5 drag and drop, delivered as DOM drag events. |
| `s.scroll(dy, seconds?)`, `s.scrollTo(locator)` | Smooth wheel scrolling. |
| `s.goto(url)` | Opens another page in the same tab. |
| `s.download(action, file)` | Runs an action that downloads a file and saves it (e.g. then `s.goto` it). |
| `s.wait(seconds)`, `s.settle()` | Pauses. |
| `s.answer = 'Name'` | What `window.prompt()` is answered with; confirms are accepted. |

Prefer role and label locators (`getByRole`, `getByLabel`), as in Playwright tests: they survive UI changes.

## The camera

With `camera: 'auto'` (the default), clicks, typing and `focus` become shots: the camera springs in to frame them,
follows nearby actions, and zooms out when nothing happens for a while. `camera: 'wide'` holds the whole window for the
beat. Sped-up chapters stay wide.

## Scenes

| Kind | Draws | `props` |
|---|---|---|
| `kinetic` | The narration as big words, each rising in as it is said. | `highlight: ['word', …]` (the brand name is always highlighted) |
| `badges` | The logo and name, then a card per item as its word is spoken, then a tagline. | `badges: [{ word, title, sub? }]`, `tagline: { text, after }` |
| `cta` | The closing card: logo, name, a line, and `brand.links`. | `line` |

Give a scene `broll` and the app plays behind it while it lasts: in a tilted window beside kinetic text, or blurred
behind badges and the closing card.

```ts
scene('Hello', 'kinetic', [beat({ say: 'Meet *Taskly*.' })], {
  broll: async (s) => {
    await s.type(s.page.getByLabel('New task'), 'Ship it');
    await s.press('Enter');
  },
});
```

## Thumbnails

```ts
thumbnail: {
  chapter: 2, at: 5,                               // a screenshot 5 s into chapter 2's take
  crop: { x: 40, y: 100, width: 1300, height: 700 },
  headlines: [{ lines: ['Your to-dos,', 'finally', 'under control.'], accentFrom: 1 }],
  chips: ['Fast', 'Simple'],
},
```

`showpilot thumbnail <cut>` writes one 1280×720 JPEG per headline.

## Checking a take

`showpilot frames <cut> 2:0 2:1 3:0` puts the screenshots from the end of those beats (chapter:beat, beats from 0)
side by side in `out/<cut>/frames-….jpg`. It's quicker than rendering to see whether an action did what you meant.
