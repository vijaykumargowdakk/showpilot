import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from './theme';

/** Slowly drifting accent and violet glows on deep navy, with a fine grain so gradients never band. */
export function Background() {
  const f = useCurrentFrame() / 60;
  const a = { x: 22 + 6 * Math.sin(f / 7), y: 18 + 5 * Math.cos(f / 9) };
  const b = { x: 80 + 5 * Math.cos(f / 8), y: 85 + 6 * Math.sin(f / 6) };
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(60% 60% at ${a.x}% ${a.y}%, ${C.accentGlow}, transparent 70%),
          radial-gradient(55% 55% at ${b.x}% ${b.y}%, color-mix(in srgb, ${C.violet} 24%, transparent), transparent 70%),
          linear-gradient(160deg, ${C.bg1}, ${C.bg0})`,
      }}
    >
      <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.07, mixBlendMode: 'overlay' }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}
