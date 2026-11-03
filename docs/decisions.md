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

**2026-11-04: The guided start saves videos outside the code repository, and 0.3.0 is the first release published by CI.** The first version of `npx showpilot` created a `video` folder inside the user's app. It now asks where to save, defaulting to a sibling `<app>-videos`, remembers the link in `SHOWPILOT_HOME/projects.json`, and records the app's path as `source:` in the brief for AI assistants. The voice and browser were already shared across projects in `SHOWPILOT_HOME`. 0.3.0 was released from `main` (tag `v0.3.0`) and the *Publish to npm* workflow published it with trusted publishing and provenance: no token, no one-time code. Maintainer's input: "i dont want this to touch the code repo", "go ahead" for the release.
