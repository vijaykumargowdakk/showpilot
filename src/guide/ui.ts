// Questions in the terminal, in the style of Claude Code: arrow keys (or a number) to choose from a list, a line to
// type with the suggested answer shown. When input isn't a terminal (a script, an AI assistant, a pipe) the same
// questions read plain lines instead: a number or name for a choice, an empty line for the suggestion.
import { emitKeypressEvents, type Key } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { prompter } from './prompt';

export type Choice<T> = { value: T; label: string; hint?: string };
export type IO = { input: Readable & { isTTY?: boolean; setRawMode?: (on: boolean) => unknown }; output: Writable };

const CLEAR_LINE = '\x1b[2K\r';
const UP = (n: number) => (n > 0 ? `\x1b[${n}A` : '');
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;

export function createUi(io: IO = { input: process.stdin, output: process.stdout }) {
  const tty = !!io.input.isTTY;
  const lines = tty ? null : prompter();
  const out = (s: string) => io.output.write(s);
  let listening: ((str: string | undefined, key: Key) => void) | null = null;

  function keys(onKey: (str: string | undefined, key: Key) => void) {
    if (!listening) {
      emitKeypressEvents(io.input);
      io.input.setRawMode?.(true);
      io.input.resume();
    } else io.input.off('keypress', listening);
    listening = onKey;
    io.input.on('keypress', onKey);
  }

  function release() {
    if (listening) io.input.off('keypress', listening);
    listening = null;
    io.input.setRawMode?.(false);
    io.input.pause();
  }

  const interrupted = () => {
    release();
    out('\n');
    process.exit(130);
  };

  /** Choose one of the options with the arrow keys (or its number) and Enter. */
  async function select<T>(message: string, options: Choice<T>[], initial = 0): Promise<T> {
    if (!tty) {
      out(`\n${message}\n${options.map((o, i) => `  ${i + 1}. ${o.label}${o.hint ? ` (${o.hint})` : ''}`).join('\n')}\n`);
      for (;;) {
        const a = (await lines!.ask(`Choose 1–${options.length} [${initial + 1}]: `)).trim().toLowerCase();
        if (!a) return options[initial].value;
        const hit = options[Number(a) - 1] ?? options.find((o) => String(o.value).toLowerCase() === a || o.label.toLowerCase() === a);
        if (hit) return hit.value;
      }
    }
    let at = initial;
    const draw = (first: boolean) => {
      if (!first) out(UP(options.length));
      for (const [i, o] of options.entries()) out(`${CLEAR_LINE}${i === at ? cyan(`❯ ${i + 1}. ${o.label}`) : `  ${i + 1}. ${o.label}`}${o.hint ? dim(`  ${o.hint}`) : ''}\n`);
    };
    out(`\n${bold(message)}  ${dim('(↑/↓ then Enter, or press a number)')}\n`);
    draw(true);
    return new Promise<T>((done) => {
      const finish = (i: number) => {
        out(UP(options.length + 1));
        out(`${CLEAR_LINE}${cyan('✔')} ${message} ${cyan(options[i].label)}\n`);
        for (let n = 0; n < options.length; n++) out(`${CLEAR_LINE}\n`);
        out(UP(options.length));
        keysDone();
        done(options[i].value);
      };
      const keysDone = () => {
        if (listening) io.input.off('keypress', listening);
        listening = null;
      };
      keys((str, key) => {
        if (key?.ctrl && key.name === 'c') return interrupted();
        if (key?.name === 'up' || key?.name === 'k') at = (at + options.length - 1) % options.length;
        else if (key?.name === 'down' || key?.name === 'j' || key?.name === 'tab') at = (at + 1) % options.length;
        else if (key?.name === 'return' || key?.name === 'enter') return finish(at);
        else if (str && /^[1-9]$/.test(str) && Number(str) <= options.length) return finish(Number(str) - 1);
        else return;
        draw(false);
      });
    });
  }

  /** Type a line; Enter alone takes the suggestion. */
  async function text(message: string, suggestion = ''): Promise<string> {
    const label = `${bold(message)}${suggestion ? dim(` (${suggestion})`) : ''} `;
    if (!tty) return (await lines!.ask(`${message}${suggestion ? ` [${suggestion}]` : ''}: `)).trim() || suggestion;
    out(`\n${label}› `);
    let typed = '';
    return new Promise<string>((done) => {
      keys((str, key) => {
        if (key?.ctrl && key.name === 'c') return interrupted();
        if (key?.name === 'return' || key?.name === 'enter') {
          if (listening) io.input.off('keypress', listening);
          listening = null;
          const answer = typed.trim() || suggestion;
          out(`\r${CLEAR_LINE}${cyan('✔')} ${message} ${cyan(answer || '(nothing)')}\n`);
          return done(answer);
        }
        if (key?.name === 'backspace') {
          if (!typed) return;
          typed = typed.slice(0, -1);
          out('\b \b');
        } else if (str && !key?.ctrl && !key?.meta && str >= ' ') {
          typed += str;
          out(str);
        }
      });
    });
  }

  /** Yes or no. */
  async function confirm(message: string, initial = true): Promise<boolean> {
    return select<boolean>(message, [{ value: true, label: 'Yes' }, { value: false, label: 'No' }], initial ? 0 : 1);
  }

  return {
    select,
    text,
    confirm,
    tty,
    close() {
      release();
      lines?.close();
      // On Windows a paused terminal input keeps a read pending, which takes keystrokes meant for a program started
      // afterwards (a child process that asks its own questions), so the real stdin is closed for good.
      if (io.input === process.stdin && tty) process.stdin.destroy();
    },
  };
}

export type Ui = ReturnType<typeof createUi>;
