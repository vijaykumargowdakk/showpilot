# Voice and subtitles

## Picking a narrator

```sh
npx showpilot voices                                  # every voice at two speeds
npx showpilot voices --voices male --speeds 0.92      # or female, or ids: am_fenrir,bf_emma
npx showpilot voices --line "Hi! | This is *my* product."
```

Open `out/voices/index.html`, listen, and put the one you like in the config:

```ts
voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
```

A `mix` blends voices by weight. `energy` (0–1) livens the read: a slightly quicker pace, a small pitch lift with
formants kept, shorter breaths and stronger stress.

## Writing lines to be spoken

The narration sounds human when it's written like speech. Hooks ("Here's the thing."), questions, short sentences,
stressed words and a beat before a reveal make far more difference than the voice itself.

| Mark | |
|---|---|
| `\|` | a breath (about 0.2 s) |
| `\|\|` | a beat (about 0.55 s) |
| `[pause 1.2]` | a pause of exactly that long |
| `*words*` | stress: a tiny lead-in, slightly slower and louder |
| `<slow>…</slow>`, `<fast>…</fast>`, `<up>…</up>` | slower, quicker, or lifted |

Avoid a breath after every item of a list; it reads like a machine. Commas are enough.

Each sentence is synthesised whole, so Kokoro keeps natural intonation; pauses are cut in at the quietest point
between words.

## Pronunciation

The built-in list (`src/voice/lexicon.json`) covers keyboard shortcuts and common acronyms. Add your own in a JSON
file and point `lexicon` at it:

```json
{
  "Taskly": "Task-lee",
  "SaaS": "sass",
  "Saoirse": "[Saoirse](/sˈɜɹʃə/)"
}
```

Keys match whole words, longest first. `[word](/phonemes/)` gives an exact pronunciation in Kokoro's phoneme set.
Subtitles always show the written form.

## Generating the narration

```sh
npx showpilot voice tour
```

Run it **before** recording: each take is paced to its lines. Audio is cached, so only changed lines are spoken
again.

## Silent cuts and subtitles

`silent: true` makes a cut with no voice. Each line stays on screen as long as it takes to read, and every render
writes:

- `out/<cut>/<cut>.srt`: subtitles, named like the video so VLC turns them on with it (Subtitle → Sub Track)
- `out/<cut>/<cut>-script.md`: every line with the time it appears, to read your own voiceover from
- `out/<cut>/chapters.txt`: chapter times for a YouTube description

## Dubbing

To add narration to a silent cut that is already rendered, without rendering again:

```sh
npx showpilot voice tour
npx showpilot dub tour        # out/tour/tour-voiced.mp4 and tour-voiced.srt
```

Each line starts where its subtitle appears. A line longer than its slot is sped up a little (at most 12%, pitch
kept), and if it still runs over, the next line waits, so lines never overlap. The video stream is copied unchanged.

Lines written to be read often sound flat when spoken. Give the beats a `speak` text written for the ear; the
subtitles of the voiced copy follow what is actually said.
