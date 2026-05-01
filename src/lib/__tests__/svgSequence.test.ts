import { describe, expect, it } from 'vitest';
import {
  buildProjectFromSequence,
  defaultTimes,
  naturalSort,
  type SequenceFrame,
} from '@/lib/svgSequence';

const wrap = (inner: string, viewBox = '0 0 100 100'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;

describe('naturalSort', () => {
  it('sorts numeric prefixes naturally', () => {
    expect(naturalSort(['frame-10.svg', 'frame-2.svg', 'frame-1.svg'])).toEqual([
      'frame-1.svg',
      'frame-2.svg',
      'frame-10.svg',
    ]);
  });
});

describe('defaultTimes', () => {
  it('produces evenly spaced times rounded to ms', () => {
    expect(defaultTimes(4, 0.1)).toEqual([0, 0.1, 0.2, 0.3]);
  });
});

describe('buildProjectFromSequence', () => {
  it('matches paths by id across frames and creates morph tracks', () => {
    const frames: SequenceFrame[] = [
      {
        name: 'a',
        time: 0,
        markup: wrap('<path id="ray" d="M0 0 L10 10" />'),
      },
      {
        name: 'b',
        time: 0.5,
        markup: wrap('<path id="ray" d="M0 0 L20 20" />'),
      },
      {
        name: 'c',
        time: 1,
        markup: wrap('<path id="ray" d="M0 0 L30 30" />'),
      },
    ];

    const result = buildProjectFromSequence(frames);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.matchedIds).toContain('ray');
    // Duration = lastKf time + trailing gap (= last segment gap, 0.5s) for seamless loop
    expect(result.project.duration).toBeCloseTo(1.5, 3);

    const child = result.project.root.children[0];
    expect(child.id).toBe('ray');
    expect(child.tag).toBe('path');

    const dTrack = child.tracks.find(t => t.prop === 'd');
    expect(dTrack).toBeDefined();
    expect(dTrack?.keyframes.length).toBe(3);
    expect(dTrack?.keyframes[0].value).toBe('M0 0 L10 10');
    expect(dTrack?.keyframes[2].value).toBe('M0 0 L30 30');
  });

  it('drives opacity to 0 when a shape is missing in some frames', () => {
    const frames: SequenceFrame[] = [
      {
        name: 'a',
        time: 0,
        markup: wrap('<path id="ray" d="M0 0 L10 10" /><path id="spark" d="M5 5 L6 6" />'),
      },
      {
        name: 'b',
        time: 0.5,
        markup: wrap('<path id="ray" d="M0 0 L20 20" />'),
      },
      {
        name: 'c',
        time: 1,
        markup: wrap('<path id="ray" d="M0 0 L30 30" /><path id="spark" d="M5 5 L7 7" />'),
      },
    ];

    const result = buildProjectFromSequence(frames);
    expect(result).not.toBeNull();
    if (!result) return;

    const spark = result.project.root.children.find(c => c.id === 'spark');
    expect(spark).toBeDefined();
    const opacityTrack = spark!.tracks.find(t => t.prop === 'opacity');
    expect(opacityTrack).toBeDefined();
    expect(opacityTrack!.keyframes.map(k => k.value)).toEqual([1, 0, 1]);
  });

  it('honors opacity attribute from svg', () => {
    const frames: SequenceFrame[] = [
      { name: 'a', time: 0, markup: wrap('<path id="ray" d="M0 0 L10 10" opacity="1" />') },
      { name: 'b', time: 0.5, markup: wrap('<path id="ray" d="M0 0 L20 20" opacity="0.3" />') },
      { name: 'c', time: 1, markup: wrap('<path id="ray" d="M0 0 L30 30" opacity="1" />') },
    ];
    const result = buildProjectFromSequence(frames);
    expect(result).not.toBeNull();
    if (!result) return;
    const ray = result.project.root.children[0];
    const opacity = ray.tracks.find(t => t.prop === 'opacity');
    expect(opacity?.keyframes.map(k => k.value)).toEqual([1, 0.3, 1]);
  });

  it('skips paths without ids and warns', () => {
    const frames: SequenceFrame[] = [
      { name: 'a', time: 0, markup: wrap('<path d="M0 0 L10 10" />') },
      { name: 'b', time: 1, markup: wrap('<path d="M0 0 L20 20" />') },
    ];
    const result = buildProjectFromSequence(frames);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.matchedIds).toEqual([]);
    expect(result.warnings.some(w => w.includes('id'))).toBe(true);
  });

  it('returns null when no frames given', () => {
    expect(buildProjectFromSequence([])).toBeNull();
  });

  it('extends duration by the last segment gap so loops are seamless', () => {
    const frames: SequenceFrame[] = [
      { name: 'a', time: 0, markup: wrap('<path id="r" d="M0 0 L1 1"/>') },
      { name: 'b', time: 0.1, markup: wrap('<path id="r" d="M0 0 L2 2"/>') },
      { name: 'c', time: 0.3, markup: wrap('<path id="r" d="M0 0 L3 3"/>') },
    ];
    const result = buildProjectFromSequence(frames);
    if (!result) throw new Error('parse failed');
    // last gap was 0.3 - 0.1 = 0.2, so duration = 0.3 + 0.2 = 0.5
    expect(result.project.duration).toBeCloseTo(0.5, 3);
  });

  it('resolves Figma <g id="X"><path d="..."/></g> wrapping to the inner path', () => {
    const frames: SequenceFrame[] = [
      {
        name: 'a',
        time: 0,
        markup: wrap('<g id="ray"><path d="M0 0 L10 10" fill="black"/></g>'),
      },
      {
        name: 'b',
        time: 0.5,
        markup: wrap('<g id="ray"><path d="M0 0 L20 20" fill="black"/></g>'),
      },
    ];
    const result = buildProjectFromSequence(frames);
    expect(result).not.toBeNull();
    if (!result) return;
    const ray = result.project.root.children[0];
    expect(ray.tag).toBe('path');
    expect(ray.attrs.d).toBe('M0 0 L10 10');
    expect(ray.attrs.fill).toBe('black');
    const dTrack = ray.tracks.find(t => t.prop === 'd');
    expect(dTrack?.keyframes.map(k => k.value)).toEqual(['M0 0 L10 10', 'M0 0 L20 20']);
  });

  it('inherits group presentation attrs onto the inner path', () => {
    const frames: SequenceFrame[] = [
      {
        name: 'a',
        time: 0,
        markup: wrap('<g id="ray" stroke="red" fill="blue"><path d="M0 0 L10 10"/></g>'),
      },
      {
        name: 'b',
        time: 0.5,
        markup: wrap('<g id="ray" stroke="red" fill="blue"><path d="M0 0 L20 20"/></g>'),
      },
    ];
    const result = buildProjectFromSequence(frames);
    if (!result) throw new Error('parse failed');
    const ray = result.project.root.children[0];
    expect(ray.attrs.stroke).toBe('red');
    expect(ray.attrs.fill).toBe('blue');
  });

  it('skips Figma frame-container <g id="N"> wrappers and matches inner paths by id', () => {
    // Mimics actual Figma export: outer <g id="frame-num"> wraps multiple ided paths
    const frames: SequenceFrame[] = [
      {
        name: '1.svg',
        time: 0,
        markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g id="1"><path id="ray-n" d="M8.5 7H7.5V1.5H8.5V7Z" fill="black"/><path id="ray-e" d="M14.5 8.5H9V7.5H14.5V8.5Z" fill="black"/></g></svg>`,
      },
      {
        name: '2.svg',
        time: 0.1,
        markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g id="2"><path id="ray-n" d="M8.5 6H7.5V2H8.5V6Z" fill="black"/><path id="ray-e" d="M14 8.5H9V7.5H14V8.5Z" fill="black"/></g></svg>`,
      },
    ];
    const result = buildProjectFromSequence(frames);
    if (!result) throw new Error('parse failed');
    const ids = result.project.root.children.map(c => c.id).sort();
    // Frame containers '1' and '2' should be skipped — only inner paths register
    expect(ids).toEqual(['ray-e', 'ray-n']);
    const rayN = result.project.root.children.find(c => c.id === 'ray-n')!;
    expect(rayN.tag).toBe('path');
    expect(rayN.tracks.find(t => t.prop === 'd')?.keyframes.length).toBe(2);
  });

  it('normalizes Figma-deduped ids like "1_2" to "1" when "1" collides in the same svg', () => {
    // Mimics Figma: wrapper `<g id="1">` collides with a layer named "1",
    // so Figma renames the path to id="1_2". In other frames there's no collision,
    // and the same layer keeps id="1". We want them to match.
    const frames: SequenceFrame[] = [
      {
        name: '1.svg',
        time: 0,
        markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g id="1"><path id="1_2" d="M0 0 L10 10" fill="black"/></g></svg>`,
      },
      {
        name: '2.svg',
        time: 0.1,
        markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g id="2"><path id="1" d="M0 0 L20 20" fill="black"/></g></svg>`,
      },
    ];
    const result = buildProjectFromSequence(frames);
    if (!result) throw new Error('parse failed');
    const ids = result.project.root.children.map(c => c.id);
    expect(ids).toEqual(['1']);
    const ray = result.project.root.children[0];
    const dTrack = ray.tracks.find(t => t.prop === 'd');
    expect(dTrack?.keyframes.length).toBe(2);
    expect(dTrack?.keyframes.map(k => k.value)).toEqual(['M0 0 L10 10', 'M0 0 L20 20']);
  });

  it('strips inline style attribute (React rejects string styles)', () => {
    const frames: SequenceFrame[] = [
      {
        name: '1.svg',
        time: 0,
        markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="ray" d="M0 0 L10 10" fill="black" style="fill:black;fill-opacity:1;"/></svg>`,
      },
      {
        name: '2.svg',
        time: 0.5,
        markup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path id="ray" d="M0 0 L20 20" fill="black" style="fill:black;fill-opacity:1;"/></svg>`,
      },
    ];
    const result = buildProjectFromSequence(frames);
    if (!result) throw new Error('parse failed');
    const ray = result.project.root.children[0];
    expect(ray.attrs.style).toBeUndefined();
    expect(ray.attrs.fill).toBe('black');
  });

  it('keeps the <g> when wrapper has multiple drawable children', () => {
    const frames: SequenceFrame[] = [
      {
        name: 'a',
        time: 0,
        markup: wrap('<g id="cluster"><path d="M0 0 L10 10"/><path d="M5 5 L7 7"/></g>'),
      },
      {
        name: 'b',
        time: 0.5,
        markup: wrap('<g id="cluster"><path d="M0 0 L20 20"/><path d="M5 5 L8 8"/></g>'),
      },
    ];
    const result = buildProjectFromSequence(frames);
    if (!result) throw new Error('parse failed');
    const cluster = result.project.root.children[0];
    expect(cluster.tag).toBe('g');
    // No `d` track on a group
    expect(cluster.tracks.find(t => t.prop === 'd')).toBeUndefined();
  });
});
