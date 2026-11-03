// Bundles the video compositions so the project's out/ folder is their public folder, without copying it.
//
// Remotion copies the public folder into every bundle, and out/ holds gigabytes of screenshots. So the bundle is made
// with an empty public folder, which is then replaced by a link to out/: a directory junction on Windows (no admin
// rights needed) or a symlink elsewhere. The link is removed before the bundle is deleted, so cleanup never reaches out/.
import { bundle } from '@remotion/bundler';
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { OUT, PKG, TMP } from '../paths.mjs';

/** Chromium options for rendering: ANGLE is the reliable GPU path on Windows; elsewhere Remotion's default is used. */
export const chromiumOptions = process.platform === 'win32' ? { gl: 'angle' as const } : {};

const isLink = (p: string) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

export async function withBundle<T>(name: string, use: (serveUrl: string) => Promise<T>): Promise<T> {
  const emptyPublic = path.join(TMP, 'empty-public');
  mkdirSync(emptyPublic, { recursive: true });
  const dir = path.join(TMP, `bundle-${name}`);
  const link = path.join(dir, 'public');
  const unlink = () => {
    if (!existsSync(link) && !isLink(link)) return;
    if (!isLink(link)) throw new Error(`${link} is not a link; refusing to delete it`);
    rmSync(link); // removes the link itself, never what it points to
  };
  if (existsSync(dir)) {
    unlink();
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(OUT, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(PKG, 'src', 'video', 'remotion', 'index.ts'), publicDir: emptyPublic, outDir: dir });
  rmSync(link, { recursive: true, force: true }); // the empty copy
  symlinkSync(OUT, link, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    return await use(serveUrl);
  } finally {
    unlink();
    if (isLink(link)) throw new Error('the link to out/ is still there; not deleting the bundle');
    rmSync(dir, { recursive: true, force: true });
  }
}
