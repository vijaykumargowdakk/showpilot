# Showpilot: project status

*Last updated 2026-11-25.*

## Read first
- This file for status
- [`docs/decisions.md`](docs/decisions.md) for why things are the way they are
- [`CLAUDE.md`](CLAUDE.md) for working rules

## Start here (next session)
0.3.0 is the latest release on npm (`npx showpilot` sets a project up; guided videos are saved outside the code
repository). Releases publish from CI: publishing a GitHub release runs `publish.yml`, which uses npm **Trusted
Publishing** (no token). 0.3.0 went out that way and carries provenance on npm. `docs/RELEASING.md` has the steps.
Next are the roadmap issues below.

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
| M4 | npm package | Publish `showpilot` (#6) | Done: on npm since 0.2.0; 0.3.0 published from CI with trusted publishing |
| M5 | Roadmap | Video sizes (#2: 4K done with `size: '4k'`; vertical 9:16 waits on a layout decision), background music (#3, done: `music` in the config), macOS testing (#4), `studio` live preview (#5, done: `showpilot studio`) | Each issue closed |

## Known issues
- npm also lists a `0.0.0-stage` version of `showpilot`. It isn't the `latest` tag, so installs don't get it.
- Recording, rendering and the voice haven't been tested on macOS (Apple Silicon) (#4).
- `showpilot dictate --record` hasn't been tested with live speech; only recorded files and microphone detection
  have.

## Action items for the owner
- Hide the `0.0.0-stage` version: `npm deprecate showpilot@0.0.0-stage "Not a release"` (needs your npm login).
- macOS testing (#4) needs an Apple Silicon machine.
- Try `showpilot dictate --record` with your microphone.
