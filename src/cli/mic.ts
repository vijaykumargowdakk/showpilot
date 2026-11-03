// Records from the default microphone with ffmpeg until Enter is pressed: DirectShow on Windows (the first audio
// device), AVFoundation on macOS, PulseAudio (or ALSA) on Linux.
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

function input(): string[] {
  if (process.platform === 'darwin') return ['-f', 'avfoundation', '-i', ':0'];
  if (process.platform === 'win32') {
    const list = spawnSync('ffmpeg', ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], { encoding: 'utf8' }).stderr ?? '';
    const name = /"([^"]+)"\s*\(audio\)/.exec(list)?.[1];
    if (!name) throw new Error('No microphone found (ffmpeg -list_devices true -f dshow -i dummy lists none). Record with any app and pass the file instead.');
    return ['-f', 'dshow', '-i', `audio=${name}`];
  }
  const pulse = spawnSync('ffmpeg', ['-hide_banner', '-f', 'pulse', '-i', 'default', '-t', '0.1', '-f', 'null', '-'], { encoding: 'utf8' }).status === 0;
  return pulse ? ['-f', 'pulse', '-i', 'default'] : ['-f', 'alsa', '-i', 'default'];
}

export async function recordMic(file: string): Promise<void> {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...input(), '-ac', '1', '-ar', '48000', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('Recording… press Enter to stop.');
  const rl = createInterface({ input: process.stdin });
  await new Promise<void>((ok) => rl.once('line', () => ok()));
  rl.close();
  ff.stdin.write('q');
  const code = await new Promise<number | null>((ok) => ff.on('close', ok));
  if (code) throw new Error(`ffmpeg stopped with code ${code} while recording`);
}
