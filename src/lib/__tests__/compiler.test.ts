import { describe, expect, it, beforeAll } from 'vitest';
import type { AnimProject } from '@/state/types';

// Minimal jsdom shim for gsap-svg + transform-origin handling
beforeAll(async () => {
  await import('@/lib/gsap');
});

const makeProject = (): AnimProject => ({
  duration: 2,
  loop: true,
  yoyo: false,
  fps: 60,
  viewBox: '0 0 100 100',
  root: {
    id: 'root',
    tag: 'svg',
    attrs: { viewBox: '0 0 100 100' },
    tracks: [],
    children: [
      {
        id: 'a',
        tag: 'rect',
        attrs: { x: '0', y: '0', width: '10', height: '10', fill: '#000' },
        children: [],
        tracks: [
          {
            prop: 'rotation',
            keyframes: [
              { id: 'k1', time: 0, value: 0, ease: 'sine.inOut' },
              { id: 'k2', time: 1, value: 90, ease: 'sine.inOut' },
            ],
          },
        ],
      },
    ],
  },
});

describe('compiler.buildTimeline', () => {
  it('produces a paused timeline with at least one tween', async () => {
    const { buildTimeline } = await import('@/lib/compiler');
    const project = makeProject();
    const refs = new Map<string, Element>();
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    refs.set('a', el);

    const tl = buildTimeline(project, refs);

    expect(tl.paused()).toBe(true);
    // Duration should be padded to project.duration (2s) since tween is only 1s
    expect(tl.duration()).toBeGreaterThanOrEqual(2);
    expect(tl.duration()).toBeLessThanOrEqual(2.01);
  });

  it('exporter emits gsap import and a timeline factory', async () => {
    const { exportCode } = await import('@/lib/exporter');
    const project = makeProject();
    const code = exportCode(project, 'buildTest');
    expect(code).toContain("import { gsap } from 'gsap'");
    expect(code).toContain('export function buildTest(root: SVGSVGElement)');
    expect(code).toContain("rotation: 90");
  });
});
