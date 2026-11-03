import { describe, expect, it } from 'vitest';
import { formatLength, parseLength, readBrief, TONES, writeBrief, type Brief } from './brief';
import { setVoice } from './config-edit';

const brief: Brief = {
  id: 'launch',
  title: 'Taskly launch',
  purpose: 'launch',
  audience: 'small teams',
  length: 90,
  tone: 'energetic',
  narration: 'ai',
  author: 'assistant',
  goals: '- Adding a task in one keystroke\n- The progress bar',
};

describe('briefs', () => {
  it('round-trips through the Markdown file', () => {
    expect(readBrief(writeBrief(brief))).toEqual(brief);
  });

  it('reads lengths the way people write them', () => {
    expect(parseLength('90')).toBe(90);
    expect(parseLength('90s')).toBe(90);
    expect(parseLength('2m')).toBe(120);
    expect(parseLength('2.5 min')).toBe(150);
    expect(parseLength('2:30')).toBe(150);
    expect(parseLength('teaser')).toBe(75);
    expect(() => parseLength('soon')).toThrow();
    expect(formatLength(75)).toBe('75 s');
    expect(formatLength(150)).toBe('2 min 30 s');
  });

  it('rejects unknown tones', () => {
    expect(() => readBrief(writeBrief(brief).replace('tone: energetic', 'tone: grumpy'))).toThrow(/tone/);
  });

  it('has a voice preset and a sample line for every tone', () => {
    for (const t of Object.values(TONES)) {
      expect(t.energy).toBeGreaterThanOrEqual(0);
      expect(t.energy).toBeLessThanOrEqual(1);
      expect(t.line.length).toBeGreaterThan(20);
    }
  });
});

describe('writing the voice into the config', () => {
  const v = { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 };

  it('replaces the line after the marker', () => {
    const cfg = "export default defineConfig({\n  app: { url: 'x' },\n  // showpilot:voice\n  // voice: { mix: { af_bella: 1 }, speed: 1, energy: 1 },\n});\n";
    const out = setVoice(cfg, v)!;
    expect(out).toContain('  // showpilot:voice\n  voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },\n});');
    expect(setVoice(out, { ...v, speed: 1 })).toContain('speed: 1, energy: 1 },\n});');
  });

  it('replaces an existing voice entry', () => {
    const cfg = "export default defineConfig({\n  app: { url: 'x' },\n  voice: { mix: { af_bella: 1 }, speed: 1, energy: 0.5 },\n  brand: { name: 'A' },\n});\n";
    const out = setVoice(cfg, v)!;
    expect(out).toContain('  voice: { mix: { am_fenrir: 0.7, am_eric: 0.3 }, speed: 0.92, energy: 1 },\n  brand');
    expect(out.match(/voice:/g)).toHaveLength(1);
  });

  it('adds one after defineConfig({ when there is none, and gives up on anything else', () => {
    expect(setVoice("export default defineConfig({\n  app: { url: 'x' },\n});\n", v)).toMatch(/^export default defineConfig\(\{\n {2}voice: /);
    expect(setVoice('export default config;', v)).toBeNull();
  });
});
