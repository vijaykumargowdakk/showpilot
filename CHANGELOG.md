# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the
project uses [semantic versioning](https://semver.org/).

## [Unreleased]

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
