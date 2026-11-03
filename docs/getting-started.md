# Getting started

## What you need

| | Windows | macOS | Linux |
|---|---|---|---|
| Node 20 or later | [nodejs.org](https://nodejs.org) | `brew install node` | your package manager or nodejs.org |
| ffmpeg on the PATH | [ffmpeg.org builds](https://ffmpeg.org/download.html) (a *full* build includes Rubber Band) | `brew install ffmpeg` | `apt install ffmpeg` (or similar) |
| Python 3.10–3.12, only for narration | [python.org](https://www.python.org/downloads/) | `brew install python@3.12` | `apt install python3.12 python3.12-venv` |

The narrator runs on an NVIDIA GPU (CUDA) when there is one, on the Apple GPU on Apple Silicon, and on the CPU
otherwise. The CPU is a few times slower, which is still fine for a few minutes of narration.

Showpilot uses ffmpeg's **Rubber Band** filter for stressed words and the energy lift in the voice. Without it the
narration still works, just a little plainer; `showpilot doctor` tells you which you have.

## Install

In the project you want to film (or in a folder of its own):

```sh
npm install --save-dev showpilot
npx showpilot setup-browser
npx showpilot init
npx showpilot doctor
```

`init` creates:

- `showpilot.config.ts`: the app to record, the brand, the narrator (see [configuration](configuration.md))
- `cuts/tour.ts`: a first script (see [writing cuts](writing-cuts.md))
- an `out/` line in `.gitignore`

Optional, for narration:

```sh
npx showpilot setup-voice   # creates the Python environment and downloads Kokoro
npx showpilot voices        # writes out/voices/index.html: listen and pick
```

`setup-voice` looks for Python 3.12, 3.11 or 3.10 on the PATH; set `SHOWPILOT_PYTHON` to use a specific one.

## Make a video

```sh
npx showpilot check tour      # quick: loads everything, lists chapters, no browser
npx showpilot voice tour      # narrated cuts only, and before recording
npx showpilot record tour     # one take per chapter (--chapter 3 re-shoots one, --from 3 resumes)
npx showpilot render tour     # out/tour/tour.mp4, tour.srt, tour-script.md, chapters.txt
```

Check a layout before a long render with `npx showpilot render tour --still 120,900` (frame numbers at 60 fps).

The stages run one at a time and hold a lock, so starting a render while a recording runs is refused rather than
slowing the recording down.

## Where everything goes

| What | Where |
|---|---|
| The browser, the Python environment, the voice model, download caches, temp files | `SHOWPILOT_HOME`, default `~/.showpilot` |
| A project's recordings, narration, renders, thumbnails | `<project>/out/` |

Set `SHOWPILOT_HOME` to keep the heavy files elsewhere, for example on a second drive:

```sh
# macOS / Linux
export SHOWPILOT_HOME=/Volumes/Data/showpilot
# Windows (PowerShell)
setx SHOWPILOT_HOME D:\showpilot
```

`npx showpilot where` lists each location with its size. To uninstall, delete `SHOWPILOT_HOME` and remove the
package; your projects' `out/` folders hold only their own videos.

Already have a Python environment with Kokoro and torch? Point `SHOWPILOT_VENV` at it to skip the download.
