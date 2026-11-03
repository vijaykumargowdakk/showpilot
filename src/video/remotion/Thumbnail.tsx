// The video's thumbnail (1280×720): a short headline on the left, a recorded screenshot cropped to the moment that
// sells the video on the right, and chips along the bottom. Headlines are big enough to read at phone size.
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { Box } from '../../recorder/script';
import type { Brand } from '../plan';
import { Background } from './Background';
import { Mark, Name } from './Brand';
import { C, FONT, themeVars } from './theme';

export type ThumbnailProps = { brand: Brand; shot: string; crop: Box; lines: string[]; accentFrom: number; chips: string[] };

export const THUMB = { w: 1280, h: 720 };

export function Thumbnail({ brand, shot, crop, lines, accentFrom, chips }: ThumbnailProps) {
  const width = 800;
  const k = width / crop.width;
  return (
    <AbsoluteFill style={{ ...themeVars(brand.accent), background: C.bg0, overflow: 'hidden' }}>
      <Background />
      {shot && (
        <AbsoluteFill style={{ perspective: 1800 }}>
          <div style={{ position: 'absolute', left: 590, top: (THUMB.h - crop.height * k) / 2 + 10, transformOrigin: '0 50%', transform: 'rotateY(14deg) rotateX(2deg)' }}>
            <div style={{ position: 'absolute', inset: -40, background: `radial-gradient(closest-side, color-mix(in srgb, ${C.violet} 55%, transparent), transparent)`, filter: 'blur(20px)' }} />
            <div style={{ position: 'relative', width, height: crop.height * k, overflow: 'hidden', borderRadius: 18, border: `3px solid ${C.violet}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
              <Img src={staticFile(shot)} style={{ position: 'absolute', left: -crop.x * k, top: -crop.y * k, width: 1920 * k }} />
            </div>
          </div>
        </AbsoluteFill>
      )}
      <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Mark brand={brand} size={54} />
        <span style={{ font: `700 46px ${FONT}`, color: C.ink, letterSpacing: -0.5 }}>
          <Name brand={brand} />
        </span>
      </div>
      <div style={{ position: 'absolute', left: 52, top: 150, font: `800 76px ${FONT}`, lineHeight: 1.02, letterSpacing: -2, color: C.ink, textShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: i >= accentFrom ? C.accent : C.ink }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 56, bottom: 44, display: 'flex', gap: 12 }}>
        {chips.map((t) => (
          <span key={t} style={{ padding: '10px 18px', borderRadius: 999, background: C.chip, border: `2px solid ${C.accent}`, font: `700 26px ${FONT}`, color: C.ink }}>
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}
