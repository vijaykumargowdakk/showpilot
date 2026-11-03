import { defineConfig } from 'showpilot';

export const REPO = 'https://github.com/vijaykumargowdakk/showpilot';

// The showcase video for Showpilot itself, filming the example app from examples/hello.
export default defineConfig({
  app: { serve: '../hello/app', ready: '#new-task', title: 'Taskly' },
  brand: {
    name: 'Showpilot',
    highlight: 'pilot',
    accent: '#5eead4',
    links: [{ label: 'Free and open source', url: REPO }],
  },
  voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },
});
