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
