// The brand as the renderer sees it: the config's brand, with the logo copied into out/_brand so the video
// compositions can load it (they can only read files inside out/).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fromProject, type Config } from '../config';
import { OUT } from '../paths.mjs';
import type { Brand } from '../video/plan';

export function brandFor(config: Config): Brand {
  const { logo } = config.brand;
  const brand = { ...config.brand, windowTitle: config.app.title };
  if (!logo) return brand;
  const src = fromProject(logo);
  if (!existsSync(src)) throw new Error(`brand.logo: ${src} does not exist`);
  const logoFile = `_brand/logo${path.extname(src)}`;
  mkdirSync(path.join(OUT, '_brand'), { recursive: true });
  copyFileSync(src, path.join(OUT, logoFile));
  return { ...brand, logoFile };
}
