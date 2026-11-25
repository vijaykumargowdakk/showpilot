import { describe, expect, it } from 'vitest';
import { descendants } from './stop.mjs';

describe('the processes a command started', () => {
  const rows = [
    [1, 0],
    [100, 1], // the launcher
    [200, 100], // the command
    [300, 200], // e.g. the browser it started
    [301, 200],
    [400, 300], // the browser's own helpers
    [500, 1], // unrelated
  ];

  it('includes children, grandchildren and further down', () => {
    expect(descendants(200, rows).sort()).toEqual([300, 301, 400]);
    expect(descendants(100, rows).sort()).toEqual([200, 300, 301, 400]);
  });

  it('leaves out the process itself, its parents and unrelated processes', () => {
    expect(descendants(200, rows)).not.toContain(200);
    expect(descendants(200, rows)).not.toContain(100);
    expect(descendants(200, rows)).not.toContain(500);
    expect(descendants(999, rows)).toEqual([]);
  });

  it('stops at a cycle instead of looping', () => {
    expect(descendants(10, [[11, 10], [10, 11]])).toEqual([11]);
  });
});
