import { defineConfig } from 'showpilot';

export default defineConfig({
  // Showpilot serves this folder itself while recording; point it at your own build (e.g. '../dist'), or set url.
  app: { serve: './app', ready: '#new-task' },
  brand: {
    name: 'Taskly',
    highlight: 'ly',
    accent: '#818cf8',
    links: [{ label: 'Made with', url: 'https://github.com/vijaykumargowdakk/showpilot' }],
  },
  // Narration is optional; this example is silent and comes with subtitles. To narrate it, pick a voice with
  // `showpilot voices`, set it here, remove `silent` from the cut, and run `showpilot voice tour` before recording.
  voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
});
