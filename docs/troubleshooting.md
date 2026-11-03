# Troubleshooting

Start with `npx showpilot doctor`: it checks Node, ffmpeg, the browser and the voice, and prints where everything is.

**"Chromium is not installed yet"**: run `npx showpilot setup-browser`.

**A take waits forever, then times out on `ready`**: the `app.ready` selector never appeared. Check it against the
page, or start the app's server first when you use `app.url`.

**"actions took 6.2 s, narration is 3.6 s"**: the beat's actions are slower than its line. It still works (the beat
just lasts longer), but the video feels better if the line is a little longer or the actions are fewer.

**A click lands on the wrong thing, or nothing happens**: use role and label locators, and `s.settle()` after
anything that animates. `showpilot frames <cut> <chapter>:<beat>` shows what the screen looked like at the end of each
beat.

**"No Python 3.10–3.12 found"**: Kokoro doesn't support newer Pythons yet. Install 3.12 and run
`npx showpilot setup-voice` again, or set `SHOWPILOT_PYTHON` to it.

**The voice is slow**: without an NVIDIA or Apple GPU it runs on the CPU. That's normal; the audio is cached, so each
line is spoken only once.

**No stress or energy in the voice, and doctor mentions Rubber Band**: your ffmpeg was built without it. Install a
full build (on Windows, the "full" builds from ffmpeg.org; on macOS, `brew install ffmpeg`).

**"… is still running"**: another heavy stage holds the lock. Wait for it to finish. If it crashed, the lock clears
itself once that process is gone.

**Rendering is slow or makes the computer sluggish**: set `RENDER_CONCURRENCY` to fewer threads (the default is half).

**An error stops the command:** Showpilot prints a one-line reason and what to do. For the full error, run the command
again with `SHOWPILOT_DEBUG=1` and include it in a bug report.

**"Warning: only 2 GB free":** recording and rendering write many files (a 90 s video can take a few GB while it works).
Free some space, or set `SHOWPILOT_HOME` to a drive with room. `showpilot where` shows what Showpilot uses.

**The first recording takes a while:** it downloads the browser (about 700 MB, once). It's kept in `SHOWPILOT_HOME`.

**"No narrator voice found" but I already installed one:** Showpilot keeps it in `SHOWPILOT_HOME` (`venv` inside it) and
asks only when it isn't there. If your voice environment is somewhere else, point `SHOWPILOT_VENV` at that folder (for
example `setx SHOWPILOT_VENV D:oice\.venv` in PowerShell, then open a new window). It is shared by every project, so
it is downloaded once.

**Something else**: [open an issue](https://github.com/vijaykumargowdakk/showpilot/issues) with the command, the
output, and `npx showpilot doctor`.
