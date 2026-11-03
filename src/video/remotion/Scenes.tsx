// Chapters drawn by the renderer rather than recorded: kinetic text, badges that appear as they are named, and the
// closing card. All of them follow the narration: words and badges appear on the frame they are spoken.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Brand, ChapterPlan } from '../plan';
import { Wordmark } from './Brand';
import { C, FONT } from './theme';

const matches = (word: string, list: string[]) => list.some((k) => word.toLowerCase().includes(k.toLowerCase()));

/** The phrase being spoken, each word rising in as it is said: large and centred, or left of the b-roll window (`side`).
 *  The brand name and props.highlight words are drawn in the accent colour. */
export function KineticScene({ plan, brand, side = false }: { plan: ChapterPlan; brand: Brand; side?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = [...plan.phrases].reverse().find((x) => frame >= x.f - 4);
  if (!p) return null;
  const highlight = [brand.name, ...(plan.props?.highlight ?? [])];
  const out = interpolate(frame, [p.to, p.to + 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: side ? 'flex-start' : 'center', justifyContent: 'center', padding: side ? '0 0 0 110px' : '0 160px', opacity: out }}>
      <div style={{ font: `700 ${side ? 74 : 92}px ${FONT}`, letterSpacing: -1.5, lineHeight: 1.15, textAlign: side ? 'left' : 'center', color: C.ink, width: side ? 700 : undefined }}>
        {p.words.map((w, i) => {
          const s = spring({ frame: frame - w.f + 3, fps, config: { damping: 16, stiffness: 140 } });
          return (
            <span key={i} style={{ display: 'inline-block', opacity: s, transform: `translateY(${(1 - s) * 40}px)`, color: matches(w.w, highlight) ? C.accent : C.ink, marginRight: side ? 20 : 24 }}>
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** The name and logo, then one badge per props.badges item as its word is said, then props.tagline. */
export function BadgesScene({ plan, brand }: { plan: ChapterPlan; brand: Brand }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = plan.words ?? [];
  const badges = plan.props?.badges ?? [];
  const at = (word: string) => words.find((w) => matches(w.w, [word]))?.f ?? Infinity;
  const logo = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 160 } });
  const first = badges.length ? at(badges[0].word) : Infinity;
  const lift = interpolate(frame, [first - 10, first + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tagline = plan.props?.tagline;
  const tag = tagline ? spring({ frame: frame - at(tagline.after), fps, config: { damping: 14 } }) : 0;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `translateY(${-230 * lift}px) scale(${(0.6 + 0.4 * logo) * (1 - 0.35 * lift)})`, opacity: logo }}>
        <Wordmark brand={brand} />
      </div>
      <div style={{ position: 'absolute', top: 400, display: 'grid', gridTemplateColumns: `repeat(${Math.min(2, badges.length || 1)}, 640px)`, gap: 28 }}>
        {badges.map((b) => {
          const s = spring({ frame: frame - at(b.word), fps, config: { damping: 12, stiffness: 170 } });
          return (
            <div
              key={b.title}
              style={{
                opacity: s,
                transform: `scale(${0.7 + 0.3 * s})`,
                padding: '28px 34px',
                borderRadius: 22,
                background: `linear-gradient(160deg, color-mix(in srgb, ${C.accent} 16%, transparent), rgba(15,42,61,0.75))`,
                border: `2px solid ${C.accent}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ font: `700 44px ${FONT}`, color: C.ink }}>{b.title}</div>
              {b.sub && <div style={{ font: `500 26px ${FONT}`, color: C.muted, marginTop: 6 }}>{b.sub}</div>}
            </div>
          );
        })}
      </div>
      {tagline && (
        <div style={{ position: 'absolute', bottom: 120, font: `600 46px ${FONT}`, color: C.accent, opacity: tag, transform: `translateY(${(1 - tag) * 30}px)` }}>{tagline.text}</div>
      )}
    </AbsoluteFill>
  );
}

/** Closing card: the name and logo, props.line, and the brand's links. */
export function CtaScene({ plan, brand }: { plan: ChapterPlan; brand: Brand }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14 } });
  const l = spring({ frame: frame - 40, fps, config: { damping: 14 } });
  const end = interpolate(frame, [plan.frames - 30, plan.frames], [1, 0], { extrapolateLeft: 'clamp' });
  const strip = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: end }}>
      <div style={{ transform: `scale(${0.8 + 0.2 * s})`, opacity: s }}>
        <Wordmark brand={brand} />
      </div>
      {plan.props?.line && <div style={{ marginTop: 34, font: `500 44px ${FONT}`, color: C.muted, opacity: s }}>{plan.props.line}</div>}
      <div style={{ marginTop: 70, display: 'flex', gap: 30, opacity: l, transform: `translateY(${(1 - l) * 30}px)` }}>
        {(brand.links ?? []).map(({ label, url }) => (
          <div key={label} style={{ padding: '22px 34px', borderRadius: 18, border: `2px solid ${C.border}`, background: 'rgba(15,42,61,0.7)' }}>
            <div style={{ font: `600 24px ${FONT}`, color: C.accent, textTransform: 'uppercase', letterSpacing: 2 }}>{label}</div>
            <div style={{ font: `600 40px ${FONT}`, color: C.ink, marginTop: 6 }}>{strip(url)}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** Shown over a sped-up recording: how fast it plays and how much real time has passed. */
export function SpeedBadge({ speed, frame }: { speed: number; frame: number }) {
  const secs = Math.floor((frame * speed) / 60);
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div style={{ position: 'absolute', top: 40, right: 60, display: 'flex', gap: 14, font: `700 34px ${FONT}` }}>
      <span style={{ padding: '10px 22px', borderRadius: 999, background: C.accent, color: C.bg0 }}>{speed}× speed</span>
      <span style={{ padding: '10px 22px', borderRadius: 999, background: C.chip, color: C.ink, border: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums' }}>⏱ {mmss}</span>
    </div>
  );
}
