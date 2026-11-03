// Things drawn over the app: the cursor and click ripples (they zoom with the app) and the keycaps and captions
// (they stay put on screen).
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { ChapterPlan } from '../plan';
import { C, FONT } from './theme';

export function Cursor({ plan, frame }: { plan: ChapterPlan; frame: number }) {
  const i = Math.min(frame, plan.frames - 1) * 5;
  const [x, y, opacity, pressed, grab] = plan.cursor.slice(i, i + 5);
  if (!opacity) return null;
  const scale = pressed ? 0.86 : 1;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, transform: `scale(${scale})`, transformOrigin: '0 0', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}>
      {grab ? (
        <svg width="34" height="34" viewBox="0 0 24 24" style={{ transform: 'translate(-12px,-10px)' }}>
          <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5V4.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v5m0-3a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2.1L8 15" fill="#fff" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="30" height="30" viewBox="0 0 24 24">
          <path d="M3 2.5 L3 19.5 L7.6 15.4 L10.6 22 L13.6 20.7 L10.7 14.2 L17 14.2 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function Ripples({ plan, frame }: { plan: ChapterPlan; frame: number }) {
  return (
    <>
      {plan.ripples
        .filter((r) => frame >= r.f && frame < r.f + 30)
        .map((r) => {
          const p = (frame - r.f) / 30;
          const size = 18 + 70 * p;
          return (
            <div
              key={r.f}
              style={{
                position: 'absolute',
                left: r.x - size / 2,
                top: r.y - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                border: `3px solid ${C.accent}`,
                background: 'rgba(94,234,212,0.18)',
                opacity: 1 - p,
              }}
            />
          );
        })}
    </>
  );
}

/** A short label pinned beside something on screen. */
export function Callouts({ plan, frame }: { plan: ChapterPlan; frame: number }) {
  const { fps } = useVideoConfig();
  return (
    <>
      {plan.callouts
        .filter((c) => frame >= c.f && frame < c.to)
        .map((c) => {
          const enter = spring({ frame: frame - c.f, fps, config: { damping: 14 } });
          const exit = interpolate(frame, [c.to - 12, c.to], [1, 0], { extrapolateLeft: 'clamp' });
          return (
            <div
              key={c.f}
              style={{
                position: 'absolute',
                left: c.box.x + c.box.width + 16,
                top: c.box.y + c.box.height / 2,
                transform: `translateY(-50%) scale(${0.8 + 0.2 * enter})`,
                transformOrigin: 'left center',
                opacity: enter * exit,
                padding: '10px 18px',
                borderRadius: 999,
                background: C.navy,
                color: C.accent,
                border: `2px solid ${C.accent}`,
                font: `600 22px ${FONT}`,
                whiteSpace: 'nowrap',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              }}
            >
              {c.text}
            </div>
          );
        })}
    </>
  );
}

export function Keycaps({ plan, frame }: { plan: ChapterPlan; frame: number }) {
  const { fps } = useVideoConfig();
  const k = [...plan.keys].reverse().find((k) => frame >= k.f && frame < k.f + 75);
  if (!k) return null;
  const enter = spring({ frame: frame - k.f, fps, config: { damping: 12 } });
  const exit = interpolate(frame, [k.f + 60, k.f + 75], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: 64, width: '100%', display: 'flex', justifyContent: 'center', gap: 12, opacity: exit, transform: `translateY(${(1 - enter) * -30}px)` }}>
      {k.keys.map((key, i) => (
        <span
          key={i}
          style={{
            minWidth: 64,
            padding: '12px 22px',
            borderRadius: 14,
            background: 'linear-gradient(#1e2d3d, #142231)',
            border: `1px solid ${C.border}`,
            boxShadow: '0 6px 0 #0a131d, 0 14px 30px rgba(0,0,0,0.4)',
            color: C.ink,
            font: `600 30px ${FONT}`,
            textAlign: 'center',
          }}
        >
          {key.length === 1 ? key.toUpperCase() : key}
        </span>
      ))}
    </div>
  );
}

export function Captions({ plan, frame }: { plan: ChapterPlan; frame: number }) {
  const p = plan.phrases.find((p) => frame >= p.f && frame < p.to);
  if (!p) return null;
  const fade = Math.min(1, (frame - p.f) / 6, (p.to - frame) / 6);
  return (
    <div style={{ position: 'absolute', bottom: 46, width: '100%', display: 'flex', justifyContent: 'center', opacity: fade }}>
      <div
        style={{
          maxWidth: 1400,
          padding: '14px 30px',
          borderRadius: 18,
          background: 'rgba(5, 11, 20, 0.88)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${C.border}`,
          font: `600 38px ${FONT}`,
          letterSpacing: -0.3,
          textAlign: 'center',
        }}
      >
        {p.words.map((w, i) => (
          <span key={i} style={{ color: frame >= w.f ? (i === p.words.findLastIndex((x) => frame >= x.f) ? C.accent : C.ink) : 'rgba(232,241,248,0.5)' }}>
            {w.w}
            {i < p.words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
