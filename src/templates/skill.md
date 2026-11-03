---
name: showpilot
description: Make a product demo video of this app with Showpilot (scripted recording, auto-zoom camera, AI narrator, subtitles). Use when the user asks for a demo, launch, walkthrough or tutorial video, a video script, or to record or render a Showpilot cut.
---

# Making a video with Showpilot

Showpilot turns a cut (`cuts/<id>.ts`) into a video: it drives the real app with Playwright, a planner adds the camera
and cursor, Kokoro narrates locally, and Remotion renders 1080p60 with subtitles. You write the cut, because you can
read this codebase; the user decides what the video is for.
Reference: https://github.com/vijaykumargowdakk/showpilot/tree/main/docs

## 1. Agree the brief first

Look for `cuts/<id>.brief.md`. If there is none, **ask the user before writing anything**, in one go:

- **Purpose:** launch, walkthrough, tutorial, or update (a release's changes)
- **Audience:** who watches it
- **Length:** teaser 60–90 s, short 2–3 min, demo 5–6 min, deep dive 10–15 min, or a number
- **Tone:** energetic, professional, friendly, calm, or playful
- **Narration:** an AI voice, their own voice (they read the script over the silent video), or silent with subtitles
- **Voice** (AI narration only): offer `npx showpilot voices`, which plays samples and writes their pick into the config
- **What it must show,** and the one thing viewers should remember

If the brief has a `source:` line, that folder holds the app's code (the videos live outside it, so read the code there).

Then write it down with `npx showpilot new <id> --purpose … --audience "…" --length 90s --tone … --narration ai|own|silent --script assistant --goals "…" --yes`.
That creates the brief, and `showpilot.config.ts` if it's missing.

If the brief says `author: self` or `author: dictate`, the user owns the words: keep the narration in
`cuts/<id>.script.md` as they wrote it, run `npx showpilot script <id>`, and only write the actions in
`cuts/<id>.actions.ts` (one per `> do:` note). Don't edit the generated `cuts/<id>.ts`.

## 2. Learn the app

- Read the README, the routes or pages, and the components the video will touch.
- **Use the app's own tests for selectors:** e2e tests (Playwright, Cypress, Testing Library) show stable roles,
  labels and test ids. Prefer `getByRole` and `getByLabel`.
- **Configure how to reach it:** set `app.url` to a running dev or preview server, or `app.serve` to a production
  build folder, which Showpilot serves itself. Set `app.ready` to a selector that appears once the app has loaded.
- **Presets:** add `app.storage` values that skip first-run tours or pick a theme.
- **Demo data must be fictional,** and the video says so.

## 3. Shape it by length

| Length | Shape |
|---|---|
| Teaser, 60–90 s | Hook (a problem or a bold claim) → 2–3 striking moments → what makes it different → call to action |
| 2–3 min | Hook → a quick tour of the main flow → 3–4 features, one chapter each → call to action |
| 5–6 min | Hook → the main flow end to end → features → how it's built or why it's trustworthy → call to action |
| 10–15 min | `silent: true` and `chapterTitles: true` are usually best; every feature in its own chapter; optionally the repository |

Scenes help: a `kinetic` opening (with `broll`, the app in use behind the words), a `badges` scene for key facts, and a
`cta` closing card that shows `brand.links`.

## 4. Write the lines for the tone and the length

**Word budget:** about 2.6 words a second when narrated, and 2.2 when silent (read as subtitles). Leave about 15% for
actions and pauses. So 90 s narrated is roughly 200 words.

- One or two sentences per beat, at most about 30 words. Each beat is a line plus what happens on screen during it.
- **Write for the ear:** short sentences, questions, a beat before a reveal. Avoid a pause after every list item;
  commas are enough.
- **Delivery marks:**
  - `|` a breath, `||` a beat, `[pause 0.5]` an exact pause
  - `*word*` stresses a word
  - `<up>…</up>` lifts the delivery, `<slow>…</slow>` slows it
- **Tone:**
  - **energetic:** "Here's the thing. || One click, | and it's *done*. <up>That's it!</up>"
  - **professional:** "Every change is reviewed | before it reaches production. || Nothing is left to chance."
  - **friendly:** "Let's add your first task. | Just type it in, | and press Enter."
  - **calm:** "Take a moment here. || Each setting | is explained | right where you need it."
  - **playful:** "Okay, | brace yourself. || This button? | It does *everything*."
- **Facts only from the code and README:** no numbers or claims you can't point to. Product names and acronyms that
  are said oddly go in the project's `lexicon` file.

## 5. Write the cut

```ts
import { beat, chapter, cut, scene, web } from 'showpilot';

export default cut({
  id: 'launch',
  title: 'Taskly: launch',
  chapters: [
    scene('Hook', 'kinetic', [beat({ say: 'Your to-dos, | finally under *control*.' })], { broll: async (s) => { /* the app in use */ } }),
    chapter('Adding a task', [
      beat({
        say: 'Type what needs doing, | and press Enter.',
        do: async (s) => {
          await s.type(s.page.getByLabel('New task'), 'Ship the launch video');
          await s.press('Enter');
        },
      }),
    ]),
    scene('Thanks', 'cta', [beat({ say: 'Try it today.' })], { props: { line: 'Free for small teams' } }),
  ],
});
```

- **Studio actions:**
  - `s.click(locator, label?)`, `s.type(locator, text)`, `s.press('Control+K')`, `s.hover(locator)`
  - `s.focus(locator, scale?)` frames something; `s.wide()` zooms out
  - `s.callout(locator, text)`, `s.drag(from, to)`, `s.dragAndDrop(locator, point)`
  - `s.scroll(dy)`, `s.scrollTo(locator)`, `s.goto(url)`, `s.wait(s)`, `s.settle()`
- **Beat options:** `camera: 'wide'`, `hold` (seconds after the line), `lead` (seconds before acting). Use `speak` for
  narration that differs from the subtitle text.
- **Chapters:** `chapter(title, beats, setup?)`, `web(title, url, beats)` and `scene(title, kind, beats, { props, broll })`.
  Scene kinds:
  - `kinetic`: `props.highlight` words
  - `badges`: `props.badges` [{ word, title, sub }] and `tagline`
  - `cta`: `props.line`
- **Thumbnail:** `thumbnail: { chapter, at, crop, headlines: [{ lines, accentFrom }], chips }`.

## 6. Record, check, render

```sh
npx showpilot check <id>        # chapters, lines and estimated length vs the brief's target
npx showpilot voice <id>        # AI narration: before recording, so takes are paced to it
npx showpilot record <id>       # --chapter N to re-shoot one chapter
npx showpilot frames <id> 2:0 2:1 3:0   # look at the screen at the end of those beats
npx showpilot render <id> --still 300,1200
npx showpilot render <id>       # out/<id>/<id>.mp4, .srt, script, chapters
npx showpilot thumbnail <id>
```

- **"actions took … narration is …"** means the line is shorter than its actions: lengthen the line or trim the actions.
- **A failed locator:** check it against the app's tests or the DOM, and `s.settle()` after animations.
- **Look at the frames** before rendering the whole video.
- **Narrated by the user (own voice):** render the silent cut, give them `out/<id>/<id>-script.md` to read along,
  then `npx showpilot align <id> <their-recording>`.

Never add a watermark, a "made with" line or Showpilot branding to a video.
