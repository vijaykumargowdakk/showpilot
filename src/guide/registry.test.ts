import { mkdtempSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findLinked, link } from './registry';

describe('registry', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'sp-reg-'));
  const file = path.join(tmp, 'projects.json');
  const videos = path.join(tmp, 'app-videos');
  mkdirSync(videos);

  it('finds nothing before a link', () => expect(findLinked(file, path.join(tmp, 'app'))).toBeUndefined());
  it('finds a linked folder', () => {
    link(file, path.join(tmp, 'app'), videos);
    expect(findLinked(file, path.join(tmp, 'app'))).toBe(videos);
  });
  it('forgets a folder that was deleted', () => {
    link(file, path.join(tmp, 'other'), path.join(tmp, 'gone'));
    expect(findLinked(file, path.join(tmp, 'other'))).toBeUndefined();
  });
});
