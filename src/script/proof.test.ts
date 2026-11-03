import { describe, expect, it } from 'vitest';
import { mishearings } from './proof';

describe('listening back', () => {
  it('finds a name the narrator says as something else', () => {
    expect(mishearings("That's *Showpilot*. | Free and open source.", "That's shop a lot. Free and open source.")).toEqual([{ wrote: 'showpilot', heard: 'shop a lot' }]);
  });

  it('is quiet when everything was said as written, ignoring case, punctuation and delivery marks', () => {
    expect(mishearings('Meet *Taskly*. | Your to-dos, || finally <up>under control</up>!', 'meet taskly your to dos finally under control')).toEqual([]);
  });

  it('ignores words that were only spelled differently, joined or split', () => {
    expect(mishearings('It knows the codebase. That is Showpilot.', 'It knows the code base. That is show pilot.')).toEqual([]);
  });

  it('skips numbers, which transcribers write either way', () => {
    expect(mishearings('It has 252 unit tests.', 'It has two hundred fifty two unit tests.')).toEqual([]);
  });

  it('reports several mistakes in one line separately', () => {
    expect(mishearings('Kokoro reads the docs aloud.', 'Cocoro reads the dogs aloud.')).toEqual([
      { wrote: 'kokoro', heard: 'cocoro' },
      { wrote: 'docs', heard: 'dogs' },
    ]);
  });
});
