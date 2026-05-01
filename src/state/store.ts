import { useSyncExternalStore } from 'react';
import type { AnimNode, AnimProject, AppState, Keyframe, PropKey } from './types';

// Bumped to v2 to invalidate the legacy "rotating star" sample stored under v1
const STORAGE_KEY = 'animatemo:project:v2';

const emptyProject = (): AnimProject => ({
  duration: 1,
  loop: true,
  yoyo: false,
  fps: 30,
  viewBox: '0 0 16 16',
  root: {
    id: 'root',
    tag: 'svg',
    attrs: {
      viewBox: '0 0 16 16',
      xmlns: 'http://www.w3.org/2000/svg',
    },
    children: [],
    tracks: [],
  },
});

const initial: AppState = {
  project: emptyProject(),
  ui: {
    selectedNodeId: null,
    playing: false,
    time: 0,
    theme: 'light',
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

const mapNode = (root: AnimNode, id: string, fn: (n: AnimNode) => AnimNode): AnimNode => {
  if (root.id === id) return fn(root);
  return {
    ...root,
    children: root.children.map(c => mapNode(c, id, fn)),
  };
};

export const actions = {
  selectNode: (id: string | null) => setUi({ selectedNodeId: id }),

  setPlaying: (v: boolean) => setUi({ playing: v }),

  setTime: (t: number) => setUi({ time: t }),

  setTheme: (theme: 'light' | 'dark') => {
    setUi({ theme });
    document.documentElement.setAttribute('data-theme', theme);
  },

  setDuration: (duration: number) => {
    setProject({ ...state.project, duration: Math.max(0.1, duration) });
  },

  // Rescale all keyframe times proportionally so the animation stretches/shrinks
  // to fit the new duration. Used by the toolbar duration input.
  scaleDuration: (duration: number) => {
    const next = Math.max(0.1, duration);
    const prev = state.project.duration;
    if (prev <= 0 || Math.abs(next - prev) < 1e-6) {
      setProject({ ...state.project, duration: next });
      return;
    }
    const factor = next / prev;
    const rescaleNode = (n: AnimNode): AnimNode => ({
      ...n,
      tracks: n.tracks.map(t => ({
        ...t,
        keyframes: t.keyframes.map(k => ({
          ...k,
          time: Math.round(k.time * factor * 1000) / 1000,
        })),
      })),
      children: n.children.map(rescaleNode),
    });
    setProject({
      ...state.project,
      duration: next,
      root: rescaleNode(state.project.root),
    });
  },

  setLoop: (loop: boolean) => setProject({ ...state.project, loop }),

  setYoyo: (yoyo: boolean) => setProject({ ...state.project, yoyo }),

  setProject,

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

  resetProject: () => {
    setProject(emptyProject());
    setUi({ selectedNodeId: null, time: 0, playing: false });
  },

  replaceProject: (project: AnimProject) => {
    setProject(project);
    const firstChild = project.root.children[0];
    setUi({
      selectedNodeId: firstChild ? firstChild.id : null,
      time: 0,
      playing: false,
    });
  },
};

export const useStore = <T>(selector: (s: AppState) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(initial)
  );

