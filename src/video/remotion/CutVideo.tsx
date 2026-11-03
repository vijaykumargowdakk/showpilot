import { createContext, useContext, type CSSProperties } from 'react';
import { AbsoluteFill, Html5Audio, Img, interpolate, Sequence, Series, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { K, OUT, toStage, VIEW, WIN, WIN_X, WIN_Y } from '../geometry';
import type { Brand, ChapterPlan } from '../plan';
import { Background } from './Background';
import { Callouts, Captions, Cursor, Keycaps, Ripples } from './Overlays';
import { BadgesScene, CtaScene, KineticScene, SpeedBadge } from './Scenes';
import type { CutProps } from './Root';
import { C, FONT, themeVars } from './theme';

const BrandContext = createContext<Brand>({ name: '' });

function TitleBar() {
  const brand = useContext(BrandContext);
  return (
    <div style={{ height: WIN.titlebar, background: C.titlebar, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: `1px solid ${C.border}` }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
        <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c, marginRight: 9 }} />
      ))}
      <span style={{ flex: 1, textAlign: 'center', marginRight: 66, color: C.muted, font: `500 15px ${FONT}` }}>{brand.name}</span>
    </div>
  );
}

function Narration({ plan }: { plan: ChapterPlan }) {
  return (
    <>
      {plan.audio.map((a) => (
        <Sequence key={a.f} from={a.f} layout="none">
          <Html5Audio src={staticFile(a.src)} />
        </Sequence>
      ))}
    </>
  );
}

/** A numbered chapter title at the top left, for the first few seconds of a chapter in long cuts. */
function ChapterTitle({ number, title, frame }: { number: number; title: string; frame: number }) {
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 10, fps, config: { damping: 16 } }) * interpolate(frame, [4.2 * fps, 4.6 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 60, top: 36, display: 'flex', alignItems: 'center', gap: 14, opacity: s, transform: `translateY(${(1 - s) * -16}px)`, font: `600 30px ${FONT}` }}>
      <span style={{ padding: '6px 16px', borderRadius: 999, background: C.accent, color: C.bg0, fontVariantNumeric: 'tabular-nums' }}>{String(number).padStart(2, '0')}</span>
      <span style={{ padding: '6px 20px', borderRadius: 999, background: 'rgba(5,11,20,0.85)', color: C.ink, border: `1px solid ${C.border}` }}>{title}</span>
    </div>
  );
}

/** The Mac-style window with a recorded screenshot, and the cursor and click ripples drawn over it. */
function AppWindow({ plan, frame, style }: { plan: ChapterPlan; frame: number; style?: CSSProperties }) {
  return (
    <div style={{ width: WIN.w, height: WIN.h + WIN.titlebar, overflow: 'hidden', background: '#fff', ...style }}>
      <TitleBar />
      <div style={{ position: 'relative', width: WIN.w, height: WIN.h }}>
        <Img src={staticFile(`${plan.dir}/${plan.files[plan.shot[Math.min(frame, plan.frames - 1)]]}`)} style={{ width: WIN.w, height: WIN.h, display: 'block' }} />
        {/* Overlays in app pixels, scaled into the window. */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: VIEW.w, height: VIEW.h, transform: `scale(${K})`, transformOrigin: '0 0' }}>
          <Ripples plan={plan} frame={frame} />
          <Callouts plan={plan} frame={frame} />
          <Cursor plan={plan} frame={frame} />
        </div>
      </div>
    </div>
  );
}

/** Opening b-roll: the app slides in on the right, tilted towards the words, and floats gently while they play. */
function SideWindow({ plan }: { plan: ChapterPlan }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 70 } });
  const out = interpolate(frame, [plan.frames - 14, plan.frames], [1, 0], { extrapolateLeft: 'clamp' });
  const float = Math.sin(frame / 95) * 8;
  return (
    <AbsoluteFill style={{ perspective: 2400, opacity: out }}>
      <div style={{ position: 'absolute', left: 790, top: (OUT.h - WIN.h - WIN.titlebar) / 2 + float, transformOrigin: '0 50%', transform: `translateX(${(1 - enter) * 700}px) rotateY(${12 + 14 * (1 - enter)}deg) rotateX(2deg) scale(0.78)` }}>
        <AppWindow plan={plan} frame={frame} style={{ borderRadius: 16, boxShadow: `0 50px 140px rgba(0,0,0,0.6), 0 0 0 1px ${C.border}` }} />
      </div>
    </AbsoluteFill>
  );
}

/** B-roll behind a scene's text: the app fills the frame, blurred and dimmed, with a slow push-in. */
function Backdrop({ plan }: { plan: ChapterPlan }) {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 20, plan.frames - 20, plan.frames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoom = 1.22 + 0.08 * (frame / plan.frames);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: 'absolute', left: OUT.w / 2, top: OUT.h / 2, transform: `translate(-50%, -50%) scale(${zoom})`, filter: 'blur(4px) brightness(0.62) saturate(0.9)' }}>
        <AppWindow plan={plan} frame={frame} />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(5,11,20,0.25) 0%, rgba(5,11,20,0.7) 80%)` }} />
    </AbsoluteFill>
  );
}

function SceneChapter({ plan }: { plan: ChapterPlan }) {
  const brand = useContext(BrandContext);
  const broll = plan.files.length > 0;
  return (
    <AbsoluteFill>
      {broll && plan.scene === 'kinetic' && <SideWindow plan={plan} />}
      {broll && plan.scene !== 'kinetic' && <Backdrop plan={plan} />}
      {plan.scene === 'kinetic' && <KineticScene plan={plan} brand={brand} side={broll} />}
      {plan.scene === 'badges' && <BadgesScene plan={plan} brand={brand} />}
      {plan.scene === 'cta' && <CtaScene plan={plan} brand={brand} />}
      <Narration plan={plan} />
    </AbsoluteFill>
  );
}

function Chapter({ plan, clean }: { plan: ChapterPlan; clean: boolean }) {
  return plan.kind === 'scene' ? <SceneChapter plan={plan} /> : <CaptureChapter plan={plan} clean={clean} />;
}

function CaptureChapter({ plan, clean }: { plan: ChapterPlan; clean: boolean }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const i = Math.min(frame, plan.frames - 1) * 3;
  const [s, x, y] = plan.cam.slice(i, i + 3);
  const p = toStage(x, y);
  // Shadow and corner radius ease off as the window fills the frame.
  const filled = Math.min(1, Math.max(0, (s - 1) / 0.25));
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <AbsoluteFill style={{ transform: `translate(${OUT.w / 2}px, ${OUT.h / 2}px) scale(${s}) translate(${-p.x}px, ${-p.y}px)`, transformOrigin: '0 0' }}>
        <AppWindow
          plan={plan}
          frame={frame}
          style={{
            position: 'absolute',
            left: WIN_X,
            top: WIN_Y,
            borderRadius: 14 * (1 - filled * 0.6),
            boxShadow: `0 ${40 * (1 - filled)}px ${120 * (1 - filled)}px rgba(0,0,0,0.55), 0 0 0 1px ${C.border}`,
          }}
        />
      </AbsoluteFill>
      <Keycaps plan={plan} frame={frame} />
      {!clean && <Captions plan={plan} frame={frame} />}
      {plan.speed && <SpeedBadge speed={plan.speed} frame={frame} />}
      {plan.number && <ChapterTitle number={plan.number} title={plan.title} frame={frame} />}
      <Narration plan={plan} />
    </AbsoluteFill>
  );
}

export function CutVideo({ plan, clean = false }: CutProps) {
  if (!plan) return null;
  return (
    <BrandContext.Provider value={plan.brand}>
    <AbsoluteFill style={{ ...themeVars(plan.brand.accent), background: C.bg0 }}>
      <Background />
      <Series>
        {plan.chapters.map((c, i) => (
          <Series.Sequence key={i} durationInFrames={c.frames}>
            <Chapter plan={c} clean={clean} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
    </BrandContext.Provider>
  );
}

