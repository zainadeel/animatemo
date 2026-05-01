export type Easing =
  | 'none'
  | 'power1.inOut'
  | 'power2.inOut'
  | 'sine.inOut'
  | 'expo.inOut';

export const PROP_KEYS = ['x', 'y', 'rotation', 'scale', 'opacity', 'fill', 'stroke', 'd'] as const;
export type PropKey = (typeof PROP_KEYS)[number];

export const NUMERIC_PROPS: PropKey[] = ['x', 'y', 'rotation', 'scale', 'opacity'];
export const STRING_PROPS: PropKey[] = ['fill', 'stroke', 'd'];

export type KeyframeValue = number | string;

export interface Keyframe {
  id: string;
  time: number;
  value: KeyframeValue;
  ease: Easing;
}

export interface Track {
  prop: PropKey;
  keyframes: Keyframe[];
}

export type SvgTag = 'svg' | 'g' | 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon';

export interface AnimNode {
  id: string;
  tag: SvgTag;
  attrs: Record<string, string>;
  children: AnimNode[];
  tracks: Track[];
}

export interface AnimProject {
  duration: number;
  loop: boolean;
  yoyo: boolean;
  fps: number;
  viewBox: string;
  root: AnimNode;
}

export interface UiState {
  selectedNodeId: string | null;
  playing: boolean;
  time: number;
  theme: 'light' | 'dark';
}

export interface AppState {
  project: AnimProject;
  ui: UiState;
}
