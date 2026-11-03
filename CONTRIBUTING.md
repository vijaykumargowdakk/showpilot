# Contributing to Showpilot

Thanks for helping! Bug reports, ideas, docs fixes and code are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/vijaykumargowdakk/showpilot/issues) first, using the bug or
  feature template. For a bug, include the command, its output and `npx showpilot doctor`.
- **Pick something up:** issues labelled `good first issue` are small and well described. Comment on the issue so
  nobody else starts the same thing.

## Development

```sh
git clone https://github.com/vijaykumargowdakk/showpilot && cd showpilot
npm install
node bin/showpilot.mjs setup-browser
npm run ci            # typecheck, lint, unit tests, and a check of the example
```

Try changes on the example: `node bin/showpilot.mjs record tour --project examples/hello`, then `render`.
Set `SHOWPILOT_HOME` if you want the browser and caches somewhere other than `~/.showpilot`.

### Layout

| Folder | |
|---|---|
| `bin/showpilot.mjs` | The CLI: parses flags, sets up the environment and the stage lock, runs a command |
| `src/cli/` | One file per command (render, voice, dub, subtitles, thumbnail, frames, check, doctor, …) |
| `src/recorder/` | The script format (`script.ts`), the Studio that drives the page, and the recorder |
| `src/video/` | The planner (camera, cursor, captions per frame), subtitles, and the Remotion compositions |
| `src/voice/` | The Python side: Kokoro engine, delivery marks, narration, audition, setup |
| `examples/hello/` | A tiny example app and cut, also used by CI |
| `docs/` | User documentation |

## Pull requests

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`). Never push to `main` directly.
2. Keep each PR to one change, with tests for logic you add (`*.test.ts` next to the code, run with Vitest).
3. Run `npm run ci` before pushing. CI runs it on Windows, macOS and Linux.
4. Update the docs and `CHANGELOG.md` (under *Unreleased*) when behaviour changes.
5. Describe what changed and why, and how you checked it (for visual changes, a still or a short clip helps).

PRs are merged with a merge commit once CI passes and a maintainer has reviewed them.

## Style

TypeScript, ES modules, no build step (the CLI runs the sources with tsx). Match the surrounding code: short
functions, a comment where the *why* isn't obvious, plain names. Prettier-style formatting, 2 spaces, single quotes.

## Licence

By contributing, you agree that your contribution is licensed under the [MIT licence](LICENSE).
