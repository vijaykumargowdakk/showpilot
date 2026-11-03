// Guessing how to reach the app being filmed, from its package.json and the folders next to it, so the setup wizard
// can suggest a web address or a build folder instead of asking people to know them.

export type PackageJson = { name?: string; scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

export type AppGuess = {
  /** The product's name, from package.json (without a scope), or the folder's name. */
  name: string;
  /** Where its dev server usually listens, e.g. http://localhost:5173. */
  url: string;
  /** The script that starts it, e.g. "npm run dev", if there is one. */
  devCommand?: string;
  /** Folders that look like a production build (they have an index.html), relative to the app. */
  builds: string[];
};

// Default dev-server ports, by the package that is used.
const PORTS: [string, number][] = [
  ['next', 3000],
  ['nuxt', 3000],
  ['@remix-run/dev', 3000],
  ['react-scripts', 3000],
  ['astro', 4321],
  ['@angular/cli', 4200],
  ['gatsby', 8000],
  ['@vue/cli-service', 8080],
  ['webpack-dev-server', 8080],
  ['parcel', 1234],
  ['@sveltejs/kit', 5173],
  ['vite', 5173],
];

const BUILD_FOLDERS = ['dist', 'build', 'out', '.output/public', 'public'];

export function detectApp(pkg: PackageJson | null, folderName: string, hasFile: (relative: string) => boolean): AppGuess {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const port = PORTS.find(([name]) => name in deps)?.[1] ?? 3000;
  const script = (['dev', 'start', 'serve'] as const).find((s) => pkg?.scripts?.[s]);
  // An explicit --port in the script beats the framework's default.
  const explicit = script && /(?:--port[= ]|-p |PORT=)(\d{3,5})/.exec(pkg!.scripts![script])?.[1];
  return {
    name: (pkg?.name ?? folderName).replace(/^@[^/]+\//, ''),
    url: `http://localhost:${explicit ?? port}`,
    devCommand: script ? (script === 'start' ? 'npm start' : `npm run ${script}`) : undefined,
    builds: BUILD_FOLDERS.filter((f) => hasFile(`${f}/index.html`)),
  };
}

/** A package name made safe for a folder or package: lowercase letters, digits and dashes. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
