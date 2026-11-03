// A tiny static file server for app.serve: records a production build without a separate server process.
// Unknown paths fall back to index.html, as single-page apps expect.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export async function serve(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  if (!existsSync(path.join(root, 'index.html'))) throw new Error(`app.serve: ${root} has no index.html (build the app first)`);
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return void res.writeHead(403).end();
    if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(path.join(file, 'index.html')) ? path.join(file, 'index.html') : path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address() as AddressInfo;
  return { url: `http://localhost:${port}/`, close: () => new Promise((ok) => server.close(() => ok())) };
}
