// Mixes placed narration clips into one track over a rendered video (the video stream is copied, not re-encoded).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { TMP } from '../paths.mjs';
import type { Timed } from '../video/placement';

// Rubber Band keeps a voice natural when sped up; some ffmpeg builds (e.g. Homebrew's) lack it, so atempo stands in.
const RUBBERBAND = (spawnSync('ffmpeg', ['-hide_banner', '-h', 'filter=rubberband'], { encoding: 'utf8' }).stdout ?? '').includes('Filter rubberband');
const stretch = (tempo: number) => (RUBBERBAND ? `rubberband=tempo=${tempo.toFixed(4)}` : `atempo=${tempo.toFixed(4)}`);

/** Lines a fit() puts late or speeds up, for the log. */
export function report(timed: Timed<{ id: string; start: number }>[]) {
  for (const c of timed.filter((x) => x.tempo > 1 || x.at > x.start + 0.05))
    console.log(`  ${c.id} at ${c.start.toFixed(1)} s: ${c.tempo > 1 ? `×${c.tempo.toFixed(2)}` : '     '}${c.at > c.start + 0.05 ? `  starts ${(c.at - c.start).toFixed(1)} s late` : ''}`);
  const late = timed.filter((c) => c.at > c.start + 0.05);
  const drift = Math.max(0, ...timed.map((c) => c.at - c.start));
  return `${timed.length} lines: ${timed.filter((c) => c.tempo > 1).length} sped up, ${late.length} start late (at most ${drift.toFixed(1)} s)`;
}

/**
 * Every clip delayed to its place and mixed without level changes. Mono clips are copied to both channels, which
 * makes them about 2 dB louder, so the track is lowered by that to stay at -16 LUFS.
 */
export function mixOnto(video: string, timed: Timed<{ file: string }>[], seconds: number, output: string) {
  if (timed.at(-1)!.end > seconds) throw new Error(`The narration ends ${(timed.at(-1)!.end - seconds).toFixed(1)} s after the video`);
  const filter = [
    ...timed.map((c, i) => `[${i + 1}:a]${c.tempo > 1 ? `${stretch(c.tempo)},` : ''}adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`),
    `${timed.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timed.length}:normalize=0:dropout_transition=0,apad,atrim=0:${seconds.toFixed(3)},aresample=48000,pan=stereo|c0=c0|c1=c0,volume=-2.1dB[out]`,
  ].join(';\n');
  const script = path.join(TMP, `mix-${path.basename(output)}.txt`);
  writeFileSync(script, filter);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, ...timed.flatMap((c) => ['-i', c.file]), '-filter_complex_script', script];
  const r = spawnSync('ffmpeg', [...args, '-map', '0:v', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', output], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
