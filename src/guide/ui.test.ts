import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createUi } from './ui';

/** A pretend terminal: keys go in as the bytes a real terminal sends; everything drawn comes out as text. */
function terminal() {
  const input = Object.assign(new PassThrough(), { isTTY: true, setRawMode: () => {} });
  const output = new PassThrough();
  let drawn = '';
  output.on('data', (d) => (drawn += d.toString()));
  const press = async (...keys: string[]) => {
    for (const k of keys) {
      input.write(k);
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  return { ui: createUi({ input, output }), press, drawn: () => drawn };
}

const DOWN = '\x1b[B';
const UP = '\x1b[A';
const ENTER = '\r';
const options = [
  { value: 'launch', label: 'Launch' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'update', label: 'Update' },
];

describe('terminal questions', () => {
  it('chooses with the arrow keys and Enter', async () => {
    const t = terminal();
    const answer = t.ui.select('Purpose', options);
    await t.press(DOWN, DOWN, UP, ENTER);
    expect(await answer).toBe('tutorial');
    expect(t.drawn()).toContain('Purpose');
  });

  it('wraps around, and starts from the suggested option', async () => {
    const t = terminal();
    const answer = t.ui.select('Purpose', options, 2);
    await t.press(DOWN, ENTER); // from the last one, down wraps to the first
    expect(await answer).toBe('launch');
  });

  it('takes a number key as the choice at once', async () => {
    const t = terminal();
    const answer = t.ui.select('Purpose', options);
    await t.press('3');
    expect(await answer).toBe('update');
  });

  it('ignores a number that is not an option', async () => {
    const t = terminal();
    const answer = t.ui.select('Purpose', options);
    await t.press('9', ENTER);
    expect(await answer).toBe('launch');
  });

  it('types a line, with backspace, and Enter alone takes the suggestion', async () => {
    const t = terminal();
    const typed = t.ui.text('Name', 'demo');
    await t.press('l', 'a', 'x', '\x7f', 'u', 'n', 'c', 'h', ENTER);
    expect(await typed).toBe('launch');
    const suggested = t.ui.text('Name', 'demo');
    await t.press(ENTER);
    expect(await suggested).toBe('demo');
  });

  it('asks several questions one after another', async () => {
    const t = terminal();
    const a = t.ui.select('One', options);
    await t.press(DOWN, ENTER);
    expect(await a).toBe('tutorial');
    const b = t.ui.confirm('Two');
    await t.press(DOWN, ENTER);
    expect(await b).toBe(false);
    const c = t.ui.text('Three', 'x');
    await t.press('y', ENTER);
    expect(await c).toBe('y');
  });
});
