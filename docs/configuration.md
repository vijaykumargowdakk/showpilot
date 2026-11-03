# Configuration

Each project has a `showpilot.config.ts` at its root:

```ts
import { defineConfig } from 'showpilot';

export default defineConfig({
  app: {
    url: 'http://localhost:5173', // or serve: '../dist' to have Showpilot serve a build itself
    ready: '#root main',          // filmed once this is on screen
    storage: { 'my-app:tour-seen': 'true' }, // localStorage set before the app loads
  },
  brand: {
    name: 'Taskly',
    highlight: 'ly',              // drawn in the accent colour
    accent: '#818cf8',
    logo: 'public/logo.svg',      // square SVG or PNG; default is the first letter on the accent colour
    links: [{ label: 'Try it', url: 'https://taskly.example' }],
  },
  voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
  lexicon: 'lexicon.json',
});
```

## `app`

| Option | |
|---|---|
| `url` | The page to record. Start your dev or preview server first. |
| `serve` | A folder of static files (a production build), relative to the project. Showpilot serves it on a free port while recording, with a fallback to `index.html` for single-page apps. Use either this or `url`. |
| `ready` | A CSS selector. Each take starts once it is on screen. Without it, takes start at the page's `load` event. |
| `storage` | localStorage keys and values set before the app's scripts run, for example to skip a welcome tour or pick a theme. |
| `resetStorage` | Clear localStorage before each take (default `true`), so every chapter starts from the same state. Storage is reset once per take, not on every reload, so a chapter can show that the app keeps its work. |
| `colorScheme` | `'light'` (default) or `'dark'`, for apps that follow the system theme. |

Recordings are 1920×1080 at a pixel density of 1, rendered at 1080p60.

## `brand`

`name` appears in the window's title bar, on the closing card, in badges scenes and on the thumbnail, and is
highlighted wherever kinetic text says it. `accent` themes the highlights, badges, chapter titles, click ripples and
the background glow. `links` are shown on the closing card.

## `voice`

A [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) voice, or a blend of several, with `speed` (1 is normal,
0.92 slightly slower and more deliberate) and `energy` (0–1: a livelier pace, a small pitch lift and stronger
stress). `showpilot voices` renders a sample of each voice so you can choose by ear. See [voice](voice.md).

Silent cuts don't need a voice.

## `lexicon`

A JSON file of written form → spoken form, merged over the built-in list (keyboard shortcuts, common acronyms,
file names). Subtitles keep the written form. See [voice](voice.md#pronunciation).

## Environment variables

| Variable | |
|---|---|
| `SHOWPILOT_HOME` | Where the browser, the voice and every cache live (default `~/.showpilot`). |
| `SHOWPILOT_VENV` | Use an existing Python environment that already has Kokoro and torch. |
| `SHOWPILOT_PYTHON` | The Python that `setup-voice` creates the environment with. |
| `RENDER_CONCURRENCY` | Render threads (default: half the CPU threads). |
