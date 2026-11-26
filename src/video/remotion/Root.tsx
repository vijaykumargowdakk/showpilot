import { Composition, getRemotionEnvironment, staticFile, watchStaticFile } from 'remotion';
import { FPS, geometryFor, LANDSCAPE } from '../geometry';
import type { RenderPlan } from '../plan';
import { CutVideo } from './CutVideo';
import { THUMB, Thumbnail, type ThumbnailProps } from './Thumbnail';

/** `clean` leaves out the captions (the render is also muted), for a version without narration. */
export type CutProps = { cut: string; plan?: RenderPlan; clean?: boolean };

const SAMPLE_THUMBNAIL: ThumbnailProps = { brand: { name: 'Showpilot', highlight: 'pilot' }, shot: '', crop: { x: 0, y: 0, width: 1920, height: 1080 }, lines: ['Your product,', 'on autopilot.'], accentFrom: 1, chips: [] };

// In Studio, `showpilot studio` rewrites the plan when the cut is saved; reloading picks up its new length and content.
const watched = new Set<string>();
function reloadOnChange(file: string) {
  if (!getRemotionEnvironment().isStudio || watched.has(file)) return;
  watched.add(file);
  watchStaticFile(file, () => window.location.reload());
}

export function Root() {
  return (
    <>
      <Composition id="Thumbnail" component={Thumbnail} width={THUMB.w} height={THUMB.h} fps={FPS} durationInFrames={1} defaultProps={SAMPLE_THUMBNAIL} />
      <Composition
        id="Cut"
        component={CutVideo}
        width={LANDSCAPE.OUT.w}
        height={LANDSCAPE.OUT.h}
        fps={FPS}
        durationInFrames={FPS}
        defaultProps={{ cut: '' } as CutProps}
        calculateMetadata={async ({ props }) => {
          reloadOnChange(`${props.cut}/render.json`);
          const plan = (await (await fetch(staticFile(`${props.cut}/render.json`))).json()) as RenderPlan;
          const { OUT } = geometryFor(plan.layout);
          return { durationInFrames: plan.frames, width: OUT.w, height: OUT.h, props: { ...props, plan } };
        }}
      />
    </>
  );
}
