# Showpilot: project status

*Last updated 2026-11-03.*

## Read first
- This file for status
- [`docs/decisions.md`](docs/decisions.md) for why things are the way they are
- [`CLAUDE.md`](CLAUDE.md) for working rules

## Start here (next session)
0.3.0 is released and on npm (published by CI through trusted publishing); 0.2.0 was the first release (`npm install --save-dev showpilot`): the showcase, guided videos (`showpilot new`,
voice picking, four ways to get a script), `showpilot listen`, `showpilot make` and the menu. The first publish was
done by the owner from their own computer (with an authenticator code), because publishing from CI with a token needs a
one-time code. npm **Trusted Publisher** is now set up (this repository, workflow `publish.yml`) and the token is
deleted, so later releases publish from CI without a token. It is untested until the next release (0.2.1 or later);
if that run fails, see `docs/RELEASING.md`. Then the roadmap issues below.

## Dev loop
```sh
npm ci                  # not npm install, which rewrites the committed lockfile
node bin/showpilot.mjs setup-browser
npm run ci              # typecheck, lint, unit tests, check of the examples
npm run typecheck       # tsc
npm run lint            # eslint
npm test                # vitest
npm run filemap         # regenerate FILEMAP.md
node bin/showpilot.mjs record tour --project examples/hello   # then: render tour (add --still for one frame)
```

## Milestones
| # | Milestone | Main work | Done when |
|---|-----------|-----------|-----------|
| M1 | 0.1.0 release | Recorder, planner, narration, dubbing, subtitles, CLI | Done (PR #1) |
| M2 | Showcase | `examples/showcase`, README GIF, window titles | Done (PR #7) |
| M3 | Guided videos | `showpilot new`, voice picking, ways to get a script | Done (PR #8) |
| M4 | npm package | Publish `showpilot` (#6) | Done: 0.3.0 on npm, published by CI with trusted publishing (verified 2026-11-04) |
| M5 | Roadmap | Video sizes (#2), background music (#3), macOS testing (#4), `studio` live preview (#5) | Each issue closed |

## Known issues
- Publishing from CI with a token failed with EOTP (npm wants a one-time code); CI now uses trusted publishing instead (see above).
- 0.2.0 shipped three compiled `__pycache__` files by accident; fixed in 0.3.0.
- Recording, rendering and the voice haven't been tested on macOS (Apple Silicon) (#4).
- `showpilot dictate --record` hasn't been tested with live speech; only recorded files and microphone detection
  have.
- The guard hook judges a compound shell command by the branch it starts on, so `git switch <branch> && git merge …`
  run from `main` is blocked; run the switch on its own first.

## Action items for the owner
- Publish to npm (#6): needs the npm account and package name.
- macOS testing (#4) needs an Apple Silicon machine.
- Try `showpilot dictate --record` with your microphone.
