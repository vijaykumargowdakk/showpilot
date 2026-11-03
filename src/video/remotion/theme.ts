// Colours are CSS variables, set on each composition's root from the brand (themeVars), so one accent colour themes
// the whole video. The default palette is deep navy with a teal accent.
import type { CSSProperties } from 'react';

export const C = {
  bg0: 'var(--sp-bg0)',
  bg1: 'var(--sp-bg1)',
  navy: 'var(--sp-navy)',
  accent: 'var(--sp-accent)',
  accentDeep: 'var(--sp-accent-deep)',
  /** The accent at low strength, for glows and tinted cards. */
  accentGlow: 'var(--sp-accent-glow)',
  violet: 'var(--sp-violet)',
  ink: 'var(--sp-ink)',
  muted: 'var(--sp-muted)',
  titlebar: 'var(--sp-titlebar)',
  border: 'var(--sp-border)',
  chip: 'var(--sp-chip)',
};

export function themeVars(accent = '#5eead4'): CSSProperties {
  return {
    '--sp-bg0': '#050b14',
    '--sp-bg1': '#0b1a2b',
    '--sp-navy': '#0f2a3d',
    '--sp-accent': accent,
    '--sp-accent-deep': `color-mix(in srgb, ${accent} 70%, #000)`,
    '--sp-accent-glow': `color-mix(in srgb, ${accent} 30%, transparent)`,
    '--sp-violet': '#8b5cf6',
    '--sp-ink': '#e8f1f8',
    '--sp-muted': '#8aa0b4',
    '--sp-titlebar': '#0d1824',
    '--sp-border': 'rgba(148, 197, 233, 0.16)',
    '--sp-chip': 'rgba(5, 11, 20, 0.85)',
  } as CSSProperties;
}

export const FONT = '"Segoe UI Variable Display", "Segoe UI", "SF Pro Display", -apple-system, "Inter", system-ui, sans-serif';
