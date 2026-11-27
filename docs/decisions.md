# Design decisions

Why Showpilot works the way it does, for anyone changing it. Newest at the bottom.

**The script drives the real app; nothing is recorded by hand.** A cut is TypeScript: chapters of beats, each a line
of narration plus Playwright actions. Re-running it re-shoots the video, so a UI change costs one command.

**The camera and cursor are drawn afterwards, not captured.** The recorder logs every action with a timestamp and
its target's box. The planner turns that into a per-frame camera (critically damped springs on a log scale, clamped
to the window) and a smoothed cursor. That is what makes 60 fps motion smooth even though the page is captured at
whatever rate it changes.

**The footage is the browser's own screenshots.** CDP `Page.startScreencast` sends a JPEG whenever the page changes;
each is shown until the next one. An encoded intermediate video was tried first, but Remotion's frame extraction was
unreliable with several render workers, and slow. Screenshots need no decoder and render at about 20–25 fps.

**One heavy stage at a time.** Voice, record, render and dub hold a lock, so a render never slows down a recording
(which would make the app look sluggish on camera) and the GPU is free when the voice needs it.

**Everything heavy lives in SHOWPILOT_HOME.** The browser, the Python environment, the model and every download cache
are redirected there through environment variables, so one folder holds it all and deleting it uninstalls it.

**Media reaches the renderer through a link, not a copy.** Remotion copies its public folder into every bundle; a
project's `out/` can hold gigabytes. The bundle is made with an empty public folder, which is then replaced by a
directory junction (Windows) or symlink (elsewhere) to `out/`, and the link is removed before the bundle is deleted.

**Narration is synthesised a sentence at a time, then shaped.** Splitting a sentence into fragments makes each one
fall in pitch as if it were ending, so pauses are cut in at the quietest point between words afterwards, using
Kokoro's word timestamps. Stress and energy use Rubber Band through ffmpeg (formants kept); without it the voice is
plainer but still works.

**Silent cuts are paced for reading.** 2.2 words a second with at least 3 s per line, slower than speech, so viewers
can read and watch at once. Word timings are estimated from the text, so silent and voiced cuts share the same
scenes and subtitle code.

**Dubbing never re-renders.** Narration is laid over a finished silent render: each line starts at its subtitle;
a line that is too long is sped up by at most 12% and the next line waits if needed, so lines never overlap.
Lines written to be read sound flat when spoken, so beats can carry a separate `speak` text.

**Videos carry no branding of Showpilot's.** No watermark, logo or credit line is ever added to a render; what is on
screen comes only from the project's own config and cuts. Credit is a matter for the code (the MIT notice), not the videos.

**2026-11-03: Project notes and hooks for AI coding sessions.** PROJECT_STATUS.md tracks where things stand,
FILEMAP.md maps every file, and `.claude/settings.json` hooks regenerate the map and review edited files at the end
of each turn; this log stays the decision record. The map is made by a Node script, since Node is already needed and
Python isn't for contributors, and it lists paths only: sizes and times differ between checkouts and between
Windows and Linux line endings, so they would change on every edit and make parallel PRs conflict. Maintainer's
input: asked for this setup, and for branches named `feat/…`, `fix/…` and so on rather than tool-generated names.

**2026-11-03: The session rules are enforced by hooks, not only written down.** A SessionStart hook puts the rules
and PROJECT_STATUS.md in every session's context (cloud sessions are given their own branch names and attribution
lines by default, which CLAUDE.md overrides), and a PreToolUse hook blocks what the rules forbid: attribution,
commits or pushes on `main` or `claude/…`, local merges into `main`. Merging a PR asks the maintainer. The hooks are
Node scripts so they run on every OS without Python. The session hook installs with `npm ci`, as CI does, because
`npm install` rewrites the committed lockfile. Maintainer's input: asked for the setup to be followed in every session.

**Questions in a terminal are tested in a real pseudo-terminal, and the program that asks closes stdin before starting another.** On Windows a paused (not closed) terminal input keeps a read pending that takes keystrokes meant for a child program, so after the guided start's first menu the next question accepted no typing, even though the unit tests with a simulated terminal passed. The launcher asks `isatty(0)` rather than touching `process.stdin`, and `ui.close()` destroys the real stdin. To test prompts, drive `node bin/showpilot.mjs` through ConPTY (the `pywinpty` Python package) and look at the screen; simulated key presses alone missed this.

**2026-11-22: Music is mixed in by ffmpeg after the render, and dips on a planned curve rather than a sidechain.**
Music is the one sound that `render`, `dub` and `align` all need, and the last two never re-render, so it is mixed
with ffmpeg after Remotion in `render` and inside the existing narration mix in `dub` and `align`; a silent render
gets it as its only sound, and the voiced versions rebuild it under their own narration. The dips come from where
each line is placed (the render plan, or the dub's fitted times), not from a compressor listening to the voice: the
music is already down when a line starts, nothing pumps on breaths, and the result is the same on every run. The
track is loudness-normalised first, so any song lands at the same level. Maintainer's input: picked issue #3 next.

**2026-11-24: `showpilot studio` runs Remotion's own CLI, serves out/ in place, and holds no lock.** Starting Studio
is documented only through Remotion's CLI, so `@remotion/cli` is a dependency (at the same version as the other
Remotion packages) and `studio` runs its `studio` command with the render plan written first, out/ as the public
folder and the cut passed as props. Studio serves the public folder where it is, so the junction/symlink trick
render bundles need (they copy the public folder) isn't needed. Studio is an interactive window that stays open, so it
holds no stage lock: a lock would block every recording and render for as long as it is open. Maintainer's input:
picked issue #5 next.

**2026-11-24: The launcher stops the command's whole process tree, and holds the lock until it has exited.** Ctrl+C in a
terminal reaches every process in the group, but a signal to the launcher alone (an IDE's stop button, `kill`) didn't
reach the command, so it kept running and the lock, which names the launcher's pid, looked stale. The launcher now runs
the command with `spawn` and, on SIGINT, SIGTERM or SIGHUP, signals the command and every process below it (found with
`ps` before anything is signalled, since orphans get re-parented; `taskkill /T` on Windows), kills what is left after a
grace period, and releases the lock only after the command has exited. Starting the command in its own process group
would have made the tree easy to signal, but it would also take the command out of the terminal's foreground, and the
guided start's questions need the keyboard. Maintainer's input: asked for #22 to be fixed.

**2026-11-25: Every text file is LF, enforced by `.gitattributes`.** The repository had grown a mix of CRLF, LF and
mixed files, so editors normalising a file turned small edits into whole-file rewrites, and a CRLF after the CLI's
shebang (`node\r`) would break the installed `showpilot` command on macOS and Linux while CI, which runs
`node bin/showpilot.mjs`, stayed green. `* text=auto eol=lf` makes git store and check out LF on every OS, and a test
checks the shebang's bytes. Maintainer's input: asked for the issues found in review (#24) to be fixed.

**2026-11-26: 4K is a recording setting, not only a render flag.** `render --4k` rendered at scale 2 from a 1×
capture, which only scales text up. `size: '4k'` makes `record` capture at device scale factor 2 (the page keeps its
1920×1080 layout, so takes look the same) and `render` output 3840×2160, and the recorded scale is kept in each
chapter's timeline so `render` can say when a chapter needs recording again. Vertical 9:16, the other half of #2, is
left for a decision on layout: record the app at a portrait viewport (its mobile layout) or crop a desktop recording.
Maintainer's input: asked for the open issues to be completed.

**2026-11-26: Layouts are geometry carried in the plan, and the first vertical one records the app at phone size.**
The frame, viewport, window and zoom range were module constants; they are now one geometry per layout, chosen in the
config and written into the render plan, so the recorder, the camera and every composition read the same numbers, and
landscape renders stay pixel-identical. `vertical-phone` (1080×1920) records the app at 430×770 CSS pixels at 3×
density, so apps show their mobile layout, drawn at 2× in a phone frame; zooms are smaller because the phone already
fills the width. Each chapter's timeline keeps its viewport, and planning refuses a take recorded for another layout
rather than drawing it wrongly. Maintainer's input: chose the phone layout first, then a crop of the desktop recording.
