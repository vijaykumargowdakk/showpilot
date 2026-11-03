// Questions in the terminal that also work when the answers are piped in (by a script or an AI assistant):
// readline's question() drops lines that arrive before it is called, so every line is queued instead.
import { createInterface } from 'node:readline';

export function prompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  const queue: string[] = [];
  let waiting: ((line: string) => void) | null = null;
  let closed = false;
  rl.on('line', (line) => {
    if (waiting) {
      const w = waiting;
      waiting = null;
      w(line);
    } else queue.push(line);
  });
  rl.on('close', () => {
    closed = true;
    waiting?.('');
  });
  return {
    /** Prints the question and resolves with the next line ('' once the input has ended). */
    ask(question: string): Promise<string> {
      process.stdout.write(question);
      if (queue.length) {
        const line = queue.shift()!;
        if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
        return Promise.resolve(line);
      }
      if (closed) return Promise.resolve('');
      return new Promise((ok) => (waiting = (line) => ok(line)));
    },
    close: () => rl.close(),
  };
}
