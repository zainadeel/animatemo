import { useSyncExternalStore } from 'react';
import type { AnimNode, AnimProject, AppState, Easing, Keyframe, PropKey, Track } from './types';
import { newId } from '@/lib/id';

const STORAGE_KEY = 'animatemo:project:v1';

const sampleProject = (): AnimProject => {
  const star: AnimNode = {
    id: 'star',
    tag: 'path',
    attrs: {
      d: 'M100 20 L120 80 L185 85 L135 125 L150 190 L100 155 L50 190 L65 125 L15 85 L80 80 Z',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linejoin': 'round',
      'transform-origin': '100px 100px',
    },
    children: [],
    tracks: [
      {
        prop: 'rotation',
        keyframes: [
          { id: newId(), time: 0, value: 0, ease: 'sine.inOut' },
          { id: newId(), time: 2, value: 360, ease: 'sine.inOut' },
        ],
      },
    ],
  };

  const root: AnimNode = {
    id: 'root',
    tag: 'svg',
    attrs: {
      width: '200',
      height: '200',
      viewBox: '0 0 200 200',
      xmlns: 'http://www.w3.org/2000/svg',
    },
    children: [star],
    tracks: [],
  };

  return {
    duration: 2,
    loop: true,
    yoyo: false,
    fps: 60,
    viewBox: '0 0 200 200',
    root,
  };
};

const initial: AppState = {
  project: sampleProject(),
  ui: {
    selectedNodeId: 'star',
    recording: false,
    playing: false,
    time: 0,
    theme: 'dark',
  },
};

const loadFromStorage = (): AppState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const project = JSON.parse(raw) as AnimProject;
    return { ...initial, project };
  } catch {
    return initial;
  }
};

let state: AppState = loadFromStorage();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());

export const getState = (): AppState => state;

export const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const setState = (patch: Partial<AppState>): void => {
  state = { ...state, ...patch };
  notify();
};

const setProject = (project: AnimProject) => {
  state = { ...state, project };
  notify();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // ignore quota errors
  }
};

const setUi = (patch: Partial<AppState['ui']>) => {
  state = { ...state, ui: { ...state.ui, ...patch } };
  notify();
};

const findNode = (root: AnimNode, id: string): AnimNode | null => {
  if (root.id === id) return root;
  for (const c of root.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
};

const mapNode = (root: AnimNode, id: string, fn: (n: AnimNode) => AnimNode): AnimNode => {
  if (root.id === id) return fn(root);
  return {
    ...root,
    children: root.children.map(c => mapNode(c, id, fn)),
  };
};

const ensureTrack = (node: AnimNode, prop: PropKey): AnimNode => {
  if (node.tracks.find(t => t.prop === prop)) return node;
  return {
    ...node,
    tracks: [...node.tracks, { prop, keyframes: [] }],
  };
};

export const actions = {
  selectNode: (id: string | null) => setUi({ selectedNodeId: id }),

  setRecording: (v: boolean) => setUi({ recording: v }),

  setPlaying: (v: boolean) => setUi({ playing: v }),

  setTime: (t: number) => setUi({ time: t }),

  setTheme: (theme: 'light' | 'dark') => {
    setUi({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  },

  setDuration: (duration: number) => {
    setProject({ ...state.project, duration: Math.max(0.1, duration) });
  },

  setLoop: (loop: boolean) => setProject({ ...state.project, loop }),

  setYoyo: (yoyo: boolean) => setProject({ ...state.project, yoyo }),

  setProject,

  setNodeAttr: (nodeId: string, attr: string, value: string) => {
    const next = mapNode(state.project.root, nodeId, n => ({
      ...n,
      attrs: { ...n.attrs, [attr]: value },
    }));
    setProject({ ...state.project, root: next });
  },

  addKeyframe: (nodeId: string, prop: PropKey, time: number, value: Keyframe['value']) => {
    const next = mapNode(state.project.root, nodeId, n => {
      const withTrack = ensureTrack(n, prop);
      return {
        ...withTrack,
        tracks: withTrack.tracks.map(t => {
          if (t.prop !== prop) return t;
          const existing = t.keyframes.find(k => Math.abs(k.time - time) < 0.001);
          if (existing) {
            return {
              ...t,
              keyframes: t.keyframes.map(k => (k.id === existing.id ? { ...k, value } : k)),
            };
          }
          const kf: Keyframe = { id: newId(), time, value, ease: 'sine.inOut' };
          return { ...t, keyframes: [...t.keyframes, kf].sort((a, b) => a.time - b.time) };
        }),
      };
    });
    setProject({ ...state.project, root: next });
  },

  removeKeyframe: (nodeId: string, prop: PropKey, kfId: string) => {
    const next = mapNode(state.project.root, nodeId, n => ({
      ...n,
      tracks: n.tracks.map(t =>
        t.prop === prop ? { ...t, keyframes: t.keyframes.filter(k => k.id !== kfId) } : t
      ),
    }));
    setProject({ ...state.project, root: next });
  },

  updateKeyframe: (
    nodeId: string,
    prop: PropKey,
    kfId: string,
    patch: Partial<Pick<Keyframe, 'time' | 'value' | 'ease'>>
  ) => {
    const next = mapNode(state.project.root, nodeId, n => ({
      ...n,
      tracks: n.tracks.map(t =>
        t.prop === prop
          ? {
              ...t,
              keyframes: t.keyframes
                .map(k => (k.id === kfId ? { ...k, ...patch } : k))
                .sort((a, b) => a.time - b.time),
            }
          : t
      ),
    }));
    setProject({ ...state.project, root: next });
  },

  setEase: (nodeId: string, prop: PropKey, kfId: string, ease: Easing) => {
    actions.updateKeyframe(nodeId, prop, kfId, { ease });
  },

  addNode: (parentId: string, node: AnimNode) => {
    const next = mapNode(state.project.root, parentId, n => ({
      ...n,
      children: [...n.children, node],
    }));
    setProject({ ...state.project, root: next });
  },

  removeNode: (nodeId: string) => {
    const remove = (n: AnimNode): AnimNode => ({
      ...n,
      children: n.children.filter(c => c.id !== nodeId).map(remove),
    });
    setProject({ ...state.project, root: remove(state.project.root) });
    if (state.ui.selectedNodeId === nodeId) setUi({ selectedNodeId: null });
  },

  resetProject: () => {
    setProject(sampleProject());
    setUi({ selectedNodeId: 'star', time: 0, playing: false });
  },
};

export const findNodeById = (id: string): AnimNode | null => findNode(state.project.root, id);

export const useStore = <T>(selector: (s: AppState) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(initial)
  );

export const findTrack = (node: AnimNode, prop: PropKey): Track | undefined =>
  node.tracks.find(t => t.prop === prop);
