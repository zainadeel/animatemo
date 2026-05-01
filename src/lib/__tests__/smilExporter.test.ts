import { describe, expect, it } from 'vitest';
import { exportSmilSvg } from '@/lib/smilExporter';
import type { AnimProject } from '@/state/types';

const makeProject = (): AnimProject => ({
  duration: 1,
  loop: true,
  yoyo: false,
  fps: 30,
  viewBox: '0 0 200 200',
  root: {
    id: 'root',
    tag: 'svg',
    attrs: { viewBox: '0 0 200 200' },
    tracks: [],
    children: [
      {
        id: 'ray-n',
        tag: 'path',
        attrs: {
          d: 'M100 20 L100 100',
          stroke: 'black',
          'stroke-width': '2',
          fill: 'none',
          'transform-origin': '100px 100px',
        },
        children: [],
        tracks: [
          {
            prop: 'd',
            keyframes: [
              { id: 'k1', time: 0, value: 'M100 20 L100 100', ease: 'sine.inOut' },
              { id: 'k2', time: 0.5, value: 'M100 60 L100 100', ease: 'sine.inOut' },
              { id: 'k3', time: 1, value: 'M100 95 L100 100', ease: 'sine.inOut' },
            ],
          },
          {
            prop: 'opacity',
            keyframes: [
              { id: 'o1', time: 0, value: 1, ease: 'sine.inOut' },
              { id: 'o2', time: 0.5, value: 0, ease: 'sine.inOut' },
              { id: 'o3', time: 1, value: 1, ease: 'sine.inOut' },
            ],
          },
        ],
      },
    ],
  },
});

describe('exportSmilSvg', () => {
  it('produces a parseable SVG with animate elements', () => {
    const svg = exportSmilSvg(makeProject());
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 200 200"');
    expect(svg).toContain('<path id="ray-n"');

    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const animates = doc.querySelectorAll('animate');
    expect(animates.length).toBe(2);
  });

  it('emits values, keyTimes, and keySplines for d morph', () => {
    const svg = exportSmilSvg(makeProject());
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const dAnim = doc.querySelector('animate[attributeName="d"]');
    expect(dAnim).not.toBeNull();
    expect(dAnim!.getAttribute('values')).toBe(
      'M100 20 L100 100;M100 60 L100 100;M100 95 L100 100'
    );
    expect(dAnim!.getAttribute('keyTimes')).toBe('0;0.5;1');
    expect(dAnim!.getAttribute('keySplines')).toBe('0.39 0 0.61 1;0.39 0 0.61 1');
    expect(dAnim!.getAttribute('calcMode')).toBe('spline');
    expect(dAnim!.getAttribute('dur')).toBe('1s');
    expect(dAnim!.getAttribute('repeatCount')).toBe('indefinite');
  });

  it('strips transform-origin from the rendered element attrs', () => {
    const svg = exportSmilSvg(makeProject());
    expect(svg).not.toContain('transform-origin');
  });

  it('appends first value as a closing keyframe when loop is on (seamless)', () => {
    // Project with duration > last keyframe time, loop on
    const project = makeProject();
    project.duration = 1.5; // last kf is at 1, so 0.5s trailing gap
    const svg = exportSmilSvg(project);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const dAnim = doc.querySelector('animate[attributeName="d"]');
    expect(dAnim).not.toBeNull();
    // Should end with the first value to close the loop
    const values = dAnim!.getAttribute('values')!.split(';');
    expect(values.length).toBe(4); // 3 original + 1 closing
    expect(values[3]).toBe(values[0]);
    const keyTimes = dAnim!.getAttribute('keyTimes')!.split(';');
    expect(keyTimes[keyTimes.length - 1]).toBe('1');
  });

  it('does not append closing keyframe when loop is off', () => {
    const project = makeProject();
    project.loop = false;
    project.duration = 1.5;
    const svg = exportSmilSvg(project);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const dAnim = doc.querySelector('animate[attributeName="d"]');
    const values = dAnim!.getAttribute('values')!.split(';');
    expect(values.length).toBe(3);
  });

  it('emits animateTransform for rotation', () => {
    const project: AnimProject = {
      ...makeProject(),
      root: {
        id: 'root',
        tag: 'svg',
        attrs: { viewBox: '0 0 200 200' },
        tracks: [],
        children: [
          {
            id: 'spin',
            tag: 'rect',
            attrs: { x: '0', y: '0', width: '10', height: '10', 'transform-origin': '50px 50px' },
            children: [],
            tracks: [
              {
                prop: 'rotation',
                keyframes: [
                  { id: 'r1', time: 0, value: 0, ease: 'sine.inOut' },
                  { id: 'r2', time: 1, value: 360, ease: 'sine.inOut' },
                ],
              },
            ],
          },
        ],
      },
    };
    const svg = exportSmilSvg(project);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const animTransform = doc.querySelector('animateTransform');
    expect(animTransform).not.toBeNull();
    expect(animTransform!.getAttribute('type')).toBe('rotate');
    expect(animTransform!.getAttribute('values')).toBe('0 50 50;360 50 50');
  });
});
