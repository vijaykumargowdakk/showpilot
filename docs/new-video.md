# Starting a video

```sh
npx showpilot new launch
```

`new` asks six things, then sets everything up:

| Question | Choices |
|---|---|
| Purpose | launch, walkthrough, tutorial, update |
| Audience | free text, e.g. "small teams who live in spreadsheets" |
| Length | teaser 60–90 s, short 2–3 min, demo 5–6 min, deep dive 10–15 min, or any length (`90s`, `4m`, `2:30`) |
| Tone | energetic, professional, friendly, calm, playful |
| Who narrates it | an AI voice you pick from samples, **you** (you read the script over the video), or nobody (silent, with subtitles) |
| Who writes the script | your AI coding assistant, you (a simple Markdown file), or you by talking it through |

It writes the answers to **`cuts/<id>.brief.md`**, the brief everything else reads. It also writes `showpilot.config.ts`
if the project doesn't have one yet. Then it hands over:

- **AI voice:** the voice picker opens (see [voice](voice.md#picking-a-narrator)).
- **Your AI assistant writes it:** the assistant's guide is installed (see [assistants](assistants.md)), and `new`
  prints the sentence to give it.
- **You write it:** `cuts/<id>.script.md` is created from a template (see [writing cuts](writing-cuts.md#writing-the-script-yourself)).
- **You dictate it:** `new` tells you how to run `showpilot dictate` (see [voice](voice.md#dictating-the-script)).
- **You narrate it:** the cut is made silent, and you read it over the video afterwards (see [voice](voice.md#your-own-voice)).

## Without the questions

Every question has a flag, so scripts and AI assistants can run it in one go. `--yes` takes the suggestion for
anything not given:

```sh
npx showpilot new launch --purpose launch --audience "small teams" --length 90s --tone energetic \
  --narration ai --script assistant --goals "adding a task in one keystroke; the progress bar" --yes
```

## The brief

```markdown
---
id: launch
title: Taskly: launch
purpose: launch
audience: small teams
length: 90
tone: energetic
narration: ai
author: assistant
---

# Taskly: launch

A launch video for small teams, about 90 s long, in an energetic tone.
…

## What it should show

- adding a task in one keystroke
- the progress bar
```

Edit it whenever plans change. `showpilot check <id>` compares the cut's estimated length with `length` and says
when it's more than 20% off. `showpilot voices --cut <id>` uses the tone for the sample line and the voice's energy.

## Tones

| Tone | Narrator energy | Speed | Writing |
|---|---|---|---|
| energetic | 1.0 | 1.0 | Short punchy lines, a beat before reveals, lifts on the payoffs |
| professional | 0.4 | 0.95 | Clear, confident statements; few exclamations |
| friendly | 0.7 | 0.97 | Warm, second person ("let's…", "you'll…") |
| calm | 0.15 | 0.9 | Slow, reassuring, more pauses |
| playful | 1.0 | 1.03 | Light, a little cheeky, surprises |
