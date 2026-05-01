import type { AnimNode, AnimProject, Easing, PropKey, Track } from '@/state/types';

// Cubic bezier control points approximating each GSAP easing's inOut form
const EASE_TO_SPLINE: Record<Easing, string> = {
  none: '0 0 1 1',
  'sine.inOut': '0.39 0 0.61 1',
  'power1.inOut': '0.42 0 0.58 1',
  'power2.inOut': '0.45 0.05 0.55 0.95',
  'expo.inOut': '0.7 0 0.3 1',
};

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const round = (n: number): number => Math.round(n * 1000) / 1000;

const formatAttr = (k: string, v: string): string => `${k}="${escapeXml(v)}"`;

interface AnimElement {
  tag: 'animate' | 'animateTransform';
  attrs: Record<string, string>;
}

interface ResolvedKeyframes {
  values: string[];
  keyTimes: string[];
  keySplines: string[];
}

const resolveKeyframes = (track: Track, duration: number, loop: boolean): ResolvedKeyframes => {
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  const values = sorted.map(k => String(k.value));
  const keyTimes = sorted.map(k => round(k.time / duration).toString());
  // N-1 splines for N keyframes — use the ease of the *target* keyframe (kfs[i+1])
  const splines = sorted
    .slice(1)
    .map(k => EASE_TO_SPLINE[k.ease] ?? EASE_TO_SPLINE['sine.inOut']);

  // Seamless loop: append first value at t=1 so the wrap morphs back smoothly
  const last = sorted[sorted.length - 1];
  const closingGap = duration - last.time;
  if (loop && closingGap > 0.001 && sorted.length >= 2) {
    values.push(String(sorted[0].value));
    keyTimes.push('1');
    splines.push(EASE_TO_SPLINE[sorted[0].ease] ?? EASE_TO_SPLINE['sine.inOut']);
  }

  return { values, keyTimes, keySplines: splines };
};

const buildAnimateForProp = (
  node: AnimNode,
  track: Track,
  duration: number,
  loop: boolean
): AnimElement[] => {
  const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
  if (sorted.length < 2) return [];

  const resolved = resolveKeyframes(track, duration, loop);
  const values = resolved.values.join(';');
  const keyTimes = resolved.keyTimes.join(';');
  const keySplines = resolved.keySplines.join(';');

  // Whether we appended a closing value to the keyTimes/values lists (for seamless loop)
  const appendsClosing = resolved.values.length === sorted.length + 1;
  // Build a list of keyframes including the synthetic closing one so transform-based
  // values arrays line up with keyTimes.
  const kfsForValues = appendsClosing ? [...sorted, sorted[0]] : sorted;

  const common = {
    dur: `${round(duration)}s`,
    repeatCount: loop ? 'indefinite' : '1',
    fill: 'freeze',
    calcMode: 'spline',
    keyTimes,
    keySplines,
    values,
  };

  const prop = track.prop;

  if (prop === 'd' || prop === 'fill' || prop === 'stroke' || prop === 'opacity') {
    return [
      {
        tag: 'animate',
        attrs: { attributeName: prop, ...common },
      },
    ];
  }

  if (prop === 'rotation') {
    const origin = node.attrs['transform-origin'] ?? '50% 50%';
    const [cx, cy] = parseOrigin(origin);
    const rotValues = kfsForValues.map(k => `${Number(k.value)} ${cx} ${cy}`).join(';');
    return [
      {
        tag: 'animateTransform',
        attrs: {
          attributeName: 'transform',
          attributeType: 'XML',
          type: 'rotate',
          additive: 'sum',
          ...common,
          values: rotValues,
        },
      },
    ];
  }

  if (prop === 'scale') {
    const scaleValues = kfsForValues.map(k => `${Number(k.value)} ${Number(k.value)}`).join(';');
    return [
      {
        tag: 'animateTransform',
        attrs: {
          attributeName: 'transform',
          attributeType: 'XML',
          type: 'scale',
          additive: 'sum',
          ...common,
          values: scaleValues,
        },
      },
    ];
  }

  if (prop === 'x' || prop === 'y') {
    // Translate uses paired x,y values; emit single-axis as `0 v` or `v 0`
    const translateValues = kfsForValues
      .map(k => (prop === 'x' ? `${Number(k.value)} 0` : `0 ${Number(k.value)}`))
      .join(';');
    return [
      {
        tag: 'animateTransform',
        attrs: {
          attributeName: 'transform',
          attributeType: 'XML',
          type: 'translate',
          additive: 'sum',
          ...common,
          values: translateValues,
        },
      },
    ];
  }

  return [];
};

const parseOrigin = (origin: string): [string, string] => {
  // Accepts "x y" or "xpx ypx" or "50% 50%"
  const parts = origin.trim().split(/\s+/);
  if (parts.length === 2) return [parts[0].replace('px', ''), parts[1].replace('px', '')];
  return ['0', '0'];
};

const renderElement = (
  node: AnimNode,
  duration: number,
  loop: boolean,
  indent = '  '
): string => {
  const animateEls: AnimElement[] = [];
  for (const track of node.tracks) {
    // `d` morph only valid on <path>
    if (track.prop === 'd' && node.tag !== 'path') continue;
    animateEls.push(...buildAnimateForProp(node, track, duration, loop));
  }

  const filteredAttrs = Object.entries(node.attrs)
    .filter(([k]) => k !== 'transform-origin')
    .map(([k, v]) => formatAttr(k, v))
    .join(' ');

  const idAttr = `id="${escapeXml(node.id)}"`;
  const openTag = `<${node.tag} ${idAttr}${filteredAttrs ? ' ' + filteredAttrs : ''}>`;
  const closeTag = `</${node.tag}>`;

  const animateLines = animateEls.map(el => {
    const attrs = Object.entries(el.attrs)
      .map(([k, v]) => formatAttr(k, v))
      .join(' ');
    return `${indent}  <${el.tag} ${attrs}/>`;
  });

  const childLines = node.children.map(c => renderElement(c, duration, loop, indent + '  '));

  const inner = [...animateLines, ...childLines].join('\n');

  if (!inner) return `${indent}${openTag}${closeTag}`;
  return `${indent}${openTag}\n${inner}\n${indent}${closeTag}`;
};

const usesProp = (node: AnimNode, props: PropKey[]): boolean => {
  if (node.tracks.some(t => props.includes(t.prop))) return true;
  return node.children.some(c => usesProp(c, props));
};

export const exportSmilSvg = (project: AnimProject): string => {
  const { root, viewBox, duration, loop } = project;

  const childMarkup = root.children
    .map(c => renderElement(c, duration, loop, '  '))
    .join('\n');

  const xmlnsXlink = usesProp(root, []) ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : '';

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg"${xmlnsXlink} viewBox="${escapeXml(viewBox)}">`,
    childMarkup,
    `</svg>`,
    ``,
  ].join('\n');
};
