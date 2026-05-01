import type { AnimNode, AnimProject, Keyframe, Track } from '@/state/types';
import { newId } from './id';

export interface SequenceFrame {
  name: string;
  markup: string;
  time: number;
}

export interface SequenceImportResult {
  project: AnimProject;
  matchedIds: string[];
  unmatchedFromFirstFrame: string[];
  warnings: string[];
}

interface ShapeSnapshot {
  d: string | null;
  opacity: number;
  tag: string;
  attrs: Record<string, string>;
}

const ANIMATABLE_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g']);
const LEAF_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon']);

// If the element is a <g> wrapping a single drawable leaf without its own id,
// return that leaf so we capture geometry rather than the empty group.
const resolveDrawable = (el: Element): Element => {
  if (el.tagName.toLowerCase() !== 'g') return el;
  const drawableChildren = Array.from(el.children).filter(c =>
    LEAF_TAGS.has(c.tagName.toLowerCase())
  );
  if (drawableChildren.length === 1 && !drawableChildren[0].hasAttribute('id')) {
    return drawableChildren[0];
  }
  return el;
};

const parseSvgDoc = (markup: string): Document | null => {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  return doc;
};

const readOpacity = (el: Element): number => {
  const direct = el.getAttribute('opacity');
  if (direct != null) {
    const n = Number(direct);
    if (!Number.isNaN(n)) return n;
  }
  const style = el.getAttribute('style');
  if (style) {
    const m = /(?:^|;)\s*opacity\s*:\s*([0-9.]+)/.exec(style);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n)) return n;
    }
  }
  if (el.getAttribute('display') === 'none') return 0;
  if (el.getAttribute('visibility') === 'hidden') return 0;
  return 1;
};

// Attrs we drop from collected shapes — they cause render issues or are redundant.
// `style` as a raw string crashes React (it needs an object).
const SKIP_ATTRS = new Set(['style']);

const collectAttrs = (el: Element, fallback?: Element): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const a of el.getAttributeNames()) {
    if (a === 'id' || SKIP_ATTRS.has(a)) continue;
    attrs[a] = el.getAttribute(a) ?? '';
  }
  if (fallback && fallback !== el) {
    for (const a of fallback.getAttributeNames()) {
      if (a === 'id' || SKIP_ATTRS.has(a)) continue;
      if (a in attrs) continue;
      attrs[a] = fallback.getAttribute(a) ?? '';
    }
  }
  return attrs;
};

// Figma deduplicates colliding ids by appending `_2`, `_3`, etc.
// If a leaf has id `X_N` and another element in the same document already uses id `X`,
// normalize to `X` so the same conceptual layer matches across frames.
const normalizeId = (rawId: string, allIds: Set<string>): string => {
  const m = /^(.+)_(\d+)$/.exec(rawId);
  if (!m) return rawId;
  const base = m[1];
  // Only strip if the base id also exists somewhere in this SVG (the collision case)
  return allIds.has(base) ? base : rawId;
};

const collectIdShapes = (root: Element): Map<string, ShapeSnapshot> => {
  const out = new Map<string, ShapeSnapshot>();
  // Pre-collect all ids in this SVG so we can detect Figma's `_2` dedup pattern
  const allIds = new Set<string>();
  for (const node of Array.from(root.querySelectorAll('[id]'))) {
    const i = node.getAttribute('id');
    if (i) allIds.add(i);
  }
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    const rawId = el.getAttribute('id');
    const id = rawId ? normalizeId(rawId, allIds) : null;

    if (id && ANIMATABLE_TAGS.has(tag)) {
      // Figma typically exports shapes as <g id="Layer"><path d="..."/></g>.
      // Resolve to the inner leaf so we capture geometry.
      const drawable = resolveDrawable(el);
      const drawableTag = drawable.tagName.toLowerCase();

      // Skip a <g> wrapper if it just contains other id'd elements — those are the
      // real shapes, and the wrapper is usually a frame container in Figma.
      const isUnresolvedGroup = drawable === el && drawableTag === 'g';
      const hasInnerIds = isUnresolvedGroup && !!el.querySelector('[id]');

      if (!isUnresolvedGroup || !hasInnerIds) {
        out.set(id, {
          d: drawableTag === 'path' ? drawable.getAttribute('d') : null,
          opacity: readOpacity(el),
          tag: drawableTag,
          attrs: collectAttrs(drawable, drawable !== el ? el : undefined),
        });
        if (drawable !== el) return; // absorbed the leaf, don't double-walk
      }
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(root);
  return out;
};

const readViewBox = (svg: Element): string => {
  const vb = svg.getAttribute('viewBox');
  if (vb) return vb;
  const w = svg.getAttribute('width') ?? '200';
  const h = svg.getAttribute('height') ?? '200';
  return `0 0 ${w} ${h}`;
};

export const buildProjectFromSequence = (
  frames: SequenceFrame[],
  opts: { fps?: number; loop?: boolean; yoyo?: boolean } = {}
): SequenceImportResult | null => {
  if (frames.length === 0) return null;
  const sorted = [...frames].sort((a, b) => a.time - b.time);

  const docs = sorted.map(f => ({ frame: f, doc: parseSvgDoc(f.markup) }));
  const firstValid = docs.find(d => d.doc != null);
  if (!firstValid || !firstValid.doc) return null;

  const firstSvg = firstValid.doc.querySelector('svg');
  if (!firstSvg) return null;

  const viewBox = readViewBox(firstSvg);
  const firstShapes = collectIdShapes(firstSvg);

  const allIds = new Set<string>(firstShapes.keys());
  const perFrameShapes: Map<string, ShapeSnapshot>[] = [];
  const warnings: string[] = [];

  for (const { frame, doc } of docs) {
    if (!doc) {
      warnings.push(`could not parse "${frame.name}" — skipped`);
      perFrameShapes.push(new Map());
      continue;
    }
    const svg = doc.querySelector('svg');
    if (!svg) {
      warnings.push(`no <svg> in "${frame.name}" — skipped`);
      perFrameShapes.push(new Map());
      continue;
    }
    const shapes = collectIdShapes(svg);
    perFrameShapes.push(shapes);
    for (const id of shapes.keys()) allIds.add(id);
  }

  const unmatchedFromFirst: string[] = [];
  const matchedIds: string[] = [];

  const children: AnimNode[] = [];

  for (const id of allIds) {
    if (!firstShapes.has(id)) unmatchedFromFirst.push(id);

    // Pick the most useful base: prefer a path snap (any frame), else first frame's snap, else any.
    const pathSnap = perFrameShapes.map(m => m.get(id)).find(s => s?.tag === 'path' && s.d);
    const baseSnap =
      pathSnap ??
      firstShapes.get(id) ??
      perFrameShapes.find(m => m.has(id))?.get(id);
    if (!baseSnap) continue;

    const dKeyframes: Keyframe[] = [];
    const opacityKeyframes: Keyframe[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const time = sorted[i].time;
      const snap = perFrameShapes[i].get(id);

      if (snap) {
        if (snap.d != null) {
          dKeyframes.push({ id: newId(), time, value: snap.d, ease: 'sine.inOut' });
        }
        opacityKeyframes.push({ id: newId(), time, value: snap.opacity, ease: 'sine.inOut' });
      } else {
        opacityKeyframes.push({ id: newId(), time, value: 0, ease: 'sine.inOut' });
      }
    }

    const allOpacityOne = opacityKeyframes.every(k => k.value === 1);
    const tracks: Track[] = [];
    // `d` is only valid on <path>. Skip if base isn't a path even if d kfs were collected.
    if (baseSnap.tag === 'path' && dKeyframes.length >= 2) {
      tracks.push({ prop: 'd', keyframes: dKeyframes });
    }
    if (!allOpacityOne) tracks.push({ prop: 'opacity', keyframes: opacityKeyframes });

    if (tracks.length > 0) matchedIds.push(id);

    const attrs: Record<string, string> = { ...baseSnap.attrs };
    if (baseSnap.tag === 'path' && baseSnap.d != null) attrs.d = baseSnap.d;
    if (!('transform-origin' in attrs)) attrs['transform-origin'] = '50% 50%';
    delete attrs.opacity;

    children.push({
      id,
      tag: baseSnap.tag as AnimNode['tag'],
      attrs,
      children: [],
      tracks,
    });
  }

  if (children.length === 0) {
    return {
      project: emptyProject(viewBox, opts),
      matchedIds: [],
      unmatchedFromFirstFrame: [],
      warnings: [
        ...warnings,
        'no shapes with `id` attributes found — add ids in Figma so frames can be matched',
      ],
    };
  }

  // Add a trailing gap equal to the spacing between the last two keyframes so
  // the loop point doesn't "snap" — every gap (including the wrap) is uniform.
  const lastTime = sorted[sorted.length - 1].time;
  const trailingGap =
    sorted.length >= 2 ? lastTime - sorted[sorted.length - 2].time : lastTime;
  const duration = Math.round((lastTime + Math.max(0, trailingGap)) * 1000) / 1000;

  const project: AnimProject = {
    duration: Math.max(0.1, duration),
    loop: opts.loop ?? true,
    yoyo: opts.yoyo ?? false,
    fps: opts.fps ?? 30,
    viewBox,
    root: {
      id: 'root',
      tag: 'svg',
      attrs: {
        viewBox,
        xmlns: 'http://www.w3.org/2000/svg',
      },
      children,
      tracks: [],
    },
  };

  return {
    project,
    matchedIds,
    unmatchedFromFirstFrame: unmatchedFromFirst,
    warnings,
  };
};

const emptyProject = (
  viewBox: string,
  opts: { fps?: number; loop?: boolean; yoyo?: boolean }
): AnimProject => ({
  duration: 1,
  loop: opts.loop ?? true,
  yoyo: opts.yoyo ?? false,
  fps: opts.fps ?? 30,
  viewBox,
  root: {
    id: 'root',
    tag: 'svg',
    attrs: { viewBox, xmlns: 'http://www.w3.org/2000/svg' },
    children: [],
    tracks: [],
  },
});

const parseLeadingNumber = (name: string): number | null => {
  const m = /(\d+(?:\.\d+)?)/.exec(name);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

export const naturalSort = (names: string[]): string[] => {
  return [...names].sort((a, b) => {
    const na = parseLeadingNumber(a);
    const nb = parseLeadingNumber(b);
    if (na != null && nb != null && na !== nb) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export const defaultTimes = (count: number, spacing: number): number[] => {
  return Array.from({ length: count }, (_, i) => Math.round(i * spacing * 1000) / 1000);
};
