# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the
project uses [semantic versioning](https://semver.org/).

## [Unreleased]

- Fixed: on Windows, after the first menu the next question took no typing (the program that asked the first question still held the keyboard). It now lets go before handing over. Tested in a real Windows console (ConPTY), for the menu, the first-run setup and `showpilot new`.
- The package no longer includes compiled Python files (`__pycache__`); 0.2.0 shipped three by accident.
- The README installs from npm, and `docs/RELEASING.md` explains trusted publishing and publishing from your own computer.
- `npx showpilot` is now the whole setup: in a project it asks where to put things and how to reach your app (suggesting a web address or built folder from your `package.json`), creates the `video` folder, installs Showpilot there, and carries on into `showpilot new`. In a project that is already set up, it opens a menu.
- Questions use arrow keys (or a number) to choose, and a line to type with the suggestion shown, like Claude Code. Without a terminal (scripts, AI assistants) they read plain lines, and every question still has a flag.
- `showpilot new` offers to set up the narrator voice right there (defaulting to No for the big download), then plays the samples.
- Recording says plainly when nothing is answering at `app.url`, instead of waiting.

## [0.2.0] - 2026-11-04

- Easier to start and use: `showpilot` alone opens a menu; `showpilot make <cut>` runs check, narrate, record and render in one go (and `--from` continues after a failure); the browser downloads itself the first time you record.
- Failures are a plain sentence with what to do, not a stack trace (`SHOWPILOT_DEBUG=1` shows the full error). Commands check beforehand that ffmpeg, the narrator and enough disk space are there.
- `showpilot listen`: transcribes the narration on your computer and lists words the narrator said differently from the script, with the lexicon entries to add. "Showpilot" is now said as "show pilot".
- README: a "Use it in your own project" section, and the showcase GIF from the 94-second video.
- `showpilot new`: a guided start that asks the purpose, audience, length, tone, narrator and who writes the script, and writes a brief (`cuts/<id>.brief.md`). Every question also has a flag.
- Tone presets (energetic, professional, friendly, calm, playful) set the narrator's energy and speed and the audition line.
- `showpilot voices` lets you pick a narrator from the samples: a "Use this voice" button on a local page, or a number in the terminal. The pick is written into `showpilot.config.ts`.
- `showpilot assistant`: a Claude Code skill and an AGENTS.md section, so your AI coding assistant writes, records and renders the video, asking about anything the brief leaves open.
- Scripts written in Markdown (`cuts/<id>.script.md`): `showpilot script` turns them into a cut, with hand-written actions kept in `cuts/<id>.actions.ts`.
- `showpilot dictate`: talk a video through (from the microphone, or any recording), transcribed on your computer with faster-whisper (`setup-voice --dictation`).
- `showpilot align`: your own recorded voiceover, found line by line and placed onto a rendered silent cut.
- `check` compares the cut's length with the brief; `doctor` reports dictation.
- The showcase now says who writes the script (your AI assistant, or you), and its opening keeps the app moving.
- `app.title` sets the window's title bar text, when the video's brand isn't the app's name.
- Web chapters show the site's host (e.g. github.com) in the window's title bar instead of the brand.
- A showcase video, made with Showpilot from `examples/showcase`.

## [0.1.0] - 2026-11-03

First public release.

- Scripted cuts of chapters and beats; the recorder drives the app with Playwright and logs every action.
- Automatic Screen Studio-style camera, glide cursor with ripples, keycaps, callouts, macOS-style window.
- Scenes: kinetic text, badges, closing card, with optional app b-roll behind them; sped-up chapters with a timer.
- Narration with Kokoro on CUDA, Apple Silicon or CPU: voice blends, delivery marks, energy, pronunciation lists.
- Silent cuts paced for reading, with `.srt` subtitles, a timestamped script and a chapter list.
- Dubbing narration onto a rendered silent cut without rendering again.
- Thumbnails, contact sheets of takes, chapter titles, `--still` frames.
- `init`, `check`, `doctor`, `where`; everything heavy kept in `SHOWPILOT_HOME`.
- Videos have no watermark or Showpilot branding.
