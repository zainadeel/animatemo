import type { AnimNode, SvgTag } from '@/state/types';
import { newId } from './id';

const ALLOWED_TAGS: SvgTag[] = ['svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'];

const elementToNode = (el: Element): AnimNode | null => {
  const tag = el.tagName.toLowerCase() as SvgTag;
  if (!ALLOWED_TAGS.includes(tag)) return null;

  const attrs: Record<string, string> = {};
  for (const a of el.getAttributeNames()) {
    if (a === 'id') continue;
    attrs[a] = el.getAttribute(a) ?? '';
  }

  const children: AnimNode[] = [];
  for (const c of el.children) {
    const child = elementToNode(c);
    if (child) children.push(child);
  }

  return {
    id: newId(),
    tag,
    attrs,
    children,
    tracks: [],
  };
};

export interface ImportedSvg {
  root: AnimNode;
  paths: { id: string; d: string; label: string }[];
}

export const parseSvg = (markup: string): ImportedSvg | null => {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) return null;
  const svg = doc.querySelector('svg');
  if (!svg) return null;

  const root = elementToNode(svg);
  if (!root) return null;

  const paths: ImportedSvg['paths'] = [];
  const collect = (n: AnimNode) => {
    if (n.tag === 'path' && n.attrs.d) {
      paths.push({
        id: n.id,
        d: n.attrs.d,
        label: `path ${paths.length + 1}`,
      });
    }
    n.children.forEach(collect);
  };
  collect(root);

  return { root, paths };
};
