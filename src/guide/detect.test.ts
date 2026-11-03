import { describe, expect, it } from 'vitest';
import { detectApp, slug } from './detect';

const none = () => false;

describe('guessing how an app is reached', () => {
  it('knows the usual dev-server ports and the script that starts it', () => {
    const vite = detectApp({ name: 'shop', scripts: { dev: 'vite' }, devDependencies: { vite: '^5' } }, 'x', none);
    expect(vite).toMatchObject({ name: 'shop', url: 'http://localhost:5173', devCommand: 'npm run dev' });
    expect(detectApp({ scripts: { start: 'next start' }, dependencies: { next: '14' } }, 'x', none)).toMatchObject({ url: 'http://localhost:3000', devCommand: 'npm start' });
    expect(detectApp({ devDependencies: { '@angular/cli': '17' } }, 'x', none).url).toBe('http://localhost:4200');
    expect(detectApp({ devDependencies: { astro: '4' } }, 'x', none).url).toBe('http://localhost:4321');
  });

  it('prefers a port written in the script', () => {
    expect(detectApp({ scripts: { dev: 'vite --port 4000' }, devDependencies: { vite: '5' } }, 'x', none).url).toBe('http://localhost:4000');
    expect(detectApp({ scripts: { start: 'PORT=8081 node server.js' } }, 'x', none).url).toBe('http://localhost:8081');
  });

  it('falls back to port 3000 and the folder name when there is no package.json', () => {
    expect(detectApp(null, 'my-app', none)).toEqual({ name: 'my-app', url: 'http://localhost:3000', devCommand: undefined, builds: [] });
  });

  it('lists build folders that have an index.html, and drops a package scope from the name', () => {
    const has = (f: string) => ['dist/index.html', 'public/index.html'].includes(f);
    const guess = detectApp({ name: '@acme/dashboard' }, 'x', has);
    expect(guess.name).toBe('dashboard');
    expect(guess.builds).toEqual(['dist', 'public']);
  });

  it('makes safe names', () => {
    expect(slug('My Cool App!')).toBe('my-cool-app');
    expect(slug('***')).toBe('app');
  });
});
