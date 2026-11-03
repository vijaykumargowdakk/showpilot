# Voice and subtitles

## Picking a narrator

```sh
npx showpilot voices --cut launch                     # every voice, reading a line in the brief's tone
npx showpilot voices --tone calm --voices female      # or male, or ids: am_fenrir,bf_emma
npx showpilot voices --line "Hi! | This is *my* product." --speeds 0.92
```

It renders a sample of each narrator, then gives you two ways to choose, at the same time:

- **A page in your browser** with every sample and a **Use this voice** button under each.
- **A numbered list in the terminal:** type the number (or `q` to decide later).

The choice goes straight into `showpilot.config.ts`, on the line under `// showpilot:voice`, replacing an existing
`voice:` entry, or added at the top of `defineConfig({`. The energy comes from the tone. If the config can't be
edited safely, the line to paste is printed instead. `--no-pick` only renders the samples (`out/voices/index.html`).

```ts
voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
```

A `mix` blends voices by weight. `energy` (0–1) livens the read: a slightly quicker pace, a small pitch lift with
formants kept, shorter breaths and stronger stress. The [tones](new-video.md#tones) set it for you.

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

**Check it by ear, without listening to everything:** after `showpilot voice`, run `showpilot listen <cut>`. It
transcribes each line on your computer (needs `setup-voice --dictation`) and lists the words that came out differently
from the script, for example a product name read as one odd word. Add those to the lexicon (a product called
"Showpilot" is `"Showpilot": "show pilot"`) and run `voice` again; only the changed lines are re-spoken. Words joined or
split differently ("codebase" / "code base") and numbers are ignored. Stressing a short word with `*…*` can blur it,
so if `listen` flags one, try without the stress marks.

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

## Your own voice

Prefer to narrate it yourself? Make the cut silent, then read it over the finished video:

```sh
npx showpilot render tour                         # silent: out/tour/tour.mp4 and out/tour/tour-script.md
# Play the video and read the script along with it, in one take, with any recorder or phone.
npx showpilot align tour my-take.m4a              # out/tour/tour-voiced.mp4 and tour-voiced.srt
```

`align` finds each line in your take, cleans it up (rumble cut, gentle compression, −16 LUFS, like the AI voice),
and places it where its subtitle appears, without rendering again. It's fine to start each line a little late or to
pause in the middle of one. Lines are found from a transcript when dictation is installed (`--no-transcribe` skips
it), and from the pauses otherwise. A line it can't find is left silent and reported.

## Dictating the script

Talk the video through instead of typing it. It's transcribed on your computer; nothing is sent anywhere.

```sh
npx showpilot setup-voice --dictation             # once: adds faster-whisper to the voice environment
npx showpilot dictate launch --record             # record from the microphone, press Enter to stop
npx showpilot dictate launch talk-through.m4a     # or transcribe any recording
```

You get `cuts/launch.script.md`: one narration line per sentence. Say **"next chapter"**, or pause for a few
seconds, to start a new chapter. Then rename the chapters, add `> do:` notes for what happens on screen, and run
`npx showpilot script launch` (see [writing cuts](writing-cuts.md#writing-the-script-yourself)). If a script already
exists, the dictation goes to `cuts/launch.dictated.script.md` unless you pass `--force`.
