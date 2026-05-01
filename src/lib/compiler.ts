import { gsap } from './gsap';
import type { AnimNode, AnimProject, PropKey } from '@/state/types';
import { NUMERIC_PROPS } from '@/state/types';

const TRANSFORM_PROPS = new Set(['x', 'y', 'rotation', 'scale']);

const tweenVarsForProp = (prop: PropKey, value: number | string): gsap.TweenVars => {
  if (prop === 'd') return { morphSVG: value as string };
  if (prop === 'fill') return { fill: value as string };
  if (prop === 'stroke') return { stroke: value as string };
  if (TRANSFORM_PROPS.has(prop)) {
    return { [prop]: value };
  }
  if (prop === 'opacity') return { opacity: value };
  return {};
};

const setInitial = (
  el: Element,
  node: AnimNode,
  prop: PropKey,
  value: number | string
): void => {
  if (prop === 'd' || prop === 'fill' || prop === 'stroke') {
    gsap.set(el, tweenVarsForProp(prop, value));
  } else if (TRANSFORM_PROPS.has(prop)) {
    gsap.set(el, { [prop]: value, transformOrigin: node.attrs['transform-origin'] ?? '50% 50%' });
  } else if (prop === 'opacity') {
    gsap.set(el, { opacity: value });
  }
};

export const buildTimeline = (
  project: AnimProject,
  refs: Map<string, Element>
): gsap.core.Timeline => {
  const tl = gsap.timeline({
    paused: true,
    repeat: project.loop ? -1 : 0,
    yoyo: project.yoyo,
    defaults: { ease: 'sine.inOut' },
  });

  const walk = (node: AnimNode) => {
    const el = refs.get(node.id);
    if (el) {
      for (const track of node.tracks) {
        const kfs = [...track.keyframes].sort((a, b) => a.time - b.time);
        if (kfs.length === 0) continue;

        const first = kfs[0];
        setInitial(el, node, track.prop, first.value);

        for (let i = 0; i < kfs.length - 1; i++) {
          const a = kfs[i];
          const b = kfs[i + 1];
          const duration = Math.max(0.001, b.time - a.time);
          const isNumeric = NUMERIC_PROPS.includes(track.prop);
          const value =
            isNumeric && typeof b.value === 'string' ? Number(b.value) : (b.value as number | string);
          const vars: gsap.TweenVars = {
            ...tweenVarsForProp(track.prop, value),
            duration,
            ease: b.ease,
          };
          if (TRANSFORM_PROPS.has(track.prop)) {
            vars.transformOrigin = node.attrs['transform-origin'] ?? '50% 50%';
          }
          tl.to(el, vars, a.time);
        }
      }
    }
    node.children.forEach(walk);
  };

  walk(project.root);

  // Pad to project duration so loop length matches user expectation
  if (tl.duration() < project.duration) {
    tl.to({}, { duration: project.duration - tl.duration() }, tl.duration());
  }

  return tl;
};
