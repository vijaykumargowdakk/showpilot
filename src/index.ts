// What a project imports: import { defineConfig, cut, chapter, scene, web, beat } from 'showpilot'.
export { defineConfig, type Config, type VoiceMix } from './config';
export { beat, beatId, chapter, cut, scene, web, type Beat, type Box, type Camera, type Chapter, type Cut, type SceneKind, type SceneProps } from './recorder/script';
export type { Point, Studio } from './recorder/studio';
