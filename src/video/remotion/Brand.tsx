// The brand on screen: the logo (or a lettered mark when there is none) and the name with its highlighted part.
import { Img, staticFile } from 'remotion';
import type { Brand } from '../plan';
import { C, FONT } from './theme';

export function Mark({ brand, size }: { brand: Brand; size: number }) {
  if (brand.logoFile) return <Img src={staticFile(brand.logoFile)} style={{ width: size, height: size, borderRadius: size * 0.22, objectFit: 'contain' }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: C.navy, border: `${Math.max(2, size / 30)}px solid ${C.accent}`, display: 'grid', placeItems: 'center', font: `800 ${size * 0.55}px ${FONT}`, color: C.accent, boxSizing: 'border-box' }}>
      {brand.name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

/** The name, with brand.highlight (if any) drawn in the accent colour. */
export function Name({ brand }: { brand: Brand }) {
  const h = brand.highlight;
  const at = h ? brand.name.indexOf(h) : -1;
  if (!h || at === -1) return <>{brand.name}</>;
  return (
    <>
      {brand.name.slice(0, at)}
      <span style={{ color: C.accent }}>{h}</span>
      {brand.name.slice(at + h.length)}
    </>
  );
}

export function Wordmark({ brand, scale = 1 }: { brand: Brand; scale?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 * scale }}>
      <Mark brand={brand} size={120 * scale} />
      <span style={{ font: `700 ${112 * scale}px ${FONT}`, color: C.ink, letterSpacing: -2 * scale }}>
        <Name brand={brand} />
      </span>
    </div>
  );
}
