// Remembers which videos folder belongs to which app folder (in SHOWPILOT_HOME/projects.json), so that running
// `npx showpilot` in the app again finds its videos even though they live outside the app's repository.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Links = Record<string, string>;

const norm = (p: string) => path.resolve(p);

function read(file: string): Links {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Links) : {};
  } catch {
    return {};
  }
}

/** The videos folder linked to this app folder, if it still exists. */
export function findLinked(file: string, appDir: string): string | undefined {
  const dir = read(file)[norm(appDir)];
  return dir && existsSync(dir) ? dir : undefined;
}

export function link(file: string, appDir: string, videosDir: string): void {
  const links = read(file);
  links[norm(appDir)] = norm(videosDir);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(links, null, 2) + '\n');
}
