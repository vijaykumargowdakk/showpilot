// A project's showpilot.config.ts: the app to record, how the video is branded, and the narrator.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Cut } from './recorder/script';
import { PROJECT } from './paths.mjs';

export type VoiceMix = Record<string, number>;

export type Config = {
  app: {
    /** The page to record, e.g. http://localhost:5173. Optional when `serve` is set. */
    url?: string;
    /** A folder of static files (a production build) that Showpilot serves itself while recording. */
    serve?: string;
    /** A CSS selector that is on screen once the app is ready to be filmed. */
    ready?: string;
    /** localStorage values set before the app loads (after clearing storage), e.g. to skip a first-run tour. */
    storage?: Record<string, string>;
    /** Clear localStorage before each take (default true), so every chapter starts from the same state. */
    resetStorage?: boolean;
    colorScheme?: 'light' | 'dark';
    /** The window's title bar text (default: brand.name), e.g. when the video's brand isn't the app's name. */
    title?: string;
  };
  brand: {
    /** Shown in the window title bar, the closing card and the thumbnail. */
    name: string;
    /** A part of the name drawn in the accent colour, e.g. 'Pilot' in 'ShowPilot'. */
    highlight?: string;
    /** Accent colour (CSS), used for highlights, badges and the cursor ripple. Default teal. */
    accent?: string;
    /** A square logo (SVG or PNG), relative to the project folder. Default: the first letter on the accent colour. */
    logo?: string;
    /** Links shown on the closing card, e.g. [{ label: 'Try it', url: 'https://…' }]. */
    links?: { label: string; url: string }[];
  };
  /** The narrator: a Kokoro voice or blend (see `showpilot voices`), speed, and energy 0–1. Omit for silent cuts only. */
  voice?: { mix: VoiceMix; speed: number; energy?: number };
  /** Extra pronunciations, relative to the project folder (merged over the built-in ones). */
  lexicon?: string;
};

export const defineConfig = (c: Config): Config => c;

export const PALETTE = { accent: '#5eead4' };

let loaded: Config | undefined;

/** The project's config (showpilot.config.ts in the project folder). */
export async function loadConfig(): Promise<Config> {
  if (loaded) return loaded;
  const file = path.join(PROJECT, 'showpilot.config.ts');
  if (!existsSync(file)) throw new Error(`No showpilot.config.ts in ${PROJECT}. Run \`showpilot init\` there, or pass --project <dir>.`);
  const c = (await import(pathToFileURL(file).href)).default as Config;
  if (!c?.app || !c.brand?.name) throw new Error(`${file} must export default defineConfig({ app, brand: { name } })`);
  if (!c.app.url && !c.app.serve) throw new Error(`${file}: set app.url, or app.serve to a folder of static files`);
  loaded = c;
  return c;
}

/** A cut from the project's cuts/ folder. */
export async function loadCut(id: string | undefined): Promise<Cut> {
  if (!id) throw new Error('Which cut? Pass its name, e.g. `showpilot record tour` for cuts/tour.ts');
  const file = path.join(PROJECT, 'cuts', `${id}.ts`);
  if (!existsSync(file)) throw new Error(`No cut named "${id}" (expected ${file})`);
  const cut = (await import(pathToFileURL(file).href)).default as Cut;
  if (!cut?.chapters) throw new Error(`${file} must export default cut({ id, title, chapters })`);
  return cut;
}

/** A path from the config, relative to the project folder. */
export const fromProject = (p: string) => path.resolve(PROJECT, p);
