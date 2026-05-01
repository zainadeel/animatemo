import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useStore, actions } from '@/state/store';
import type { AnimNode } from '@/state/types';
import { useTimeline } from '@/hooks/useTimeline';
import styles from './Canvas.module.css';

const toCamel = (k: string): string =>
  k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

// Attributes that are only valid on certain SVG tags. React errors on bad combos
// (e.g. <g d="..."> from buggy historical imports).
const TAG_ONLY_ATTRS: Record<string, Set<string>> = {
  path: new Set(['d']),
  circle: new Set(['cx', 'cy', 'r']),
  rect: new Set(['x', 'y', 'width', 'height', 'rx', 'ry']),
  line: new Set(['x1', 'y1', 'x2', 'y2']),
  polyline: new Set(['points']),
  polygon: new Set(['points']),
};
const ALL_TAG_ONLY = new Set(
  Object.values(TAG_ONLY_ATTRS).flatMap(s => Array.from(s))
);

const reactAttrs = (attrs: Record<string, string>, tag: string): Record<string, string> => {
  const allowed = TAG_ONLY_ATTRS[tag] ?? new Set<string>();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    // Skip attrs that are only valid on a different tag
    if (ALL_TAG_ONLY.has(k) && !allowed.has(k)) continue;
    if (k.startsWith('data-') || k.startsWith('aria-') || k === 'xmlns') {
      out[k] = v;
    } else if (k.includes('-')) {
      out[toCamel(k)] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
};

interface NodeProps {
  node: AnimNode;
}

const SvgNode = ({ node }: NodeProps) => {
  const { registerRef } = useTimeline();
  const setRef = useCallback(
    (el: SVGElement | null) => registerRef(node.id, el),
    [registerRef, node.id]
  );

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    actions.selectNode(node.id);
  };

  const safeAttrs = useMemo(() => reactAttrs(node.attrs, node.tag), [node.attrs, node.tag]);

  const props = {
    ...safeAttrs,
    ref: setRef,
    onClick,
    'data-node-id': node.id,
  } as Record<string, unknown>;

  switch (node.tag) {
    case 'g':
      return <g {...props}>{node.children.map(c => <SvgNode key={c.id} node={c} />)}</g>;
    case 'path':
      return <path {...props} />;
    case 'circle':
      return <circle {...props} />;
    case 'rect':
      return <rect {...props} />;
    case 'line':
      return <line {...props} />;
    case 'polyline':
      return <polyline {...props} />;
    case 'polygon':
      return <polygon {...props} />;
    default:
      return null;
  }
};

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Watches the selected element and reports its current bounding box so we can
// render a thin selection overlay rect on top.
const useSelectionBBox = (id: string | null, project: unknown): BBox | null => {
  const [bbox, setBBox] = useState<BBox | null>(null);
  useEffect(() => {
    if (!id) {
      setBBox(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(
        `[data-node-id="${CSS.escape(id)}"]`
      ) as SVGGraphicsElement | null;
      if (el && typeof el.getBBox === 'function') {
        try {
          const b = el.getBBox();
          setBBox(prev => {
            if (
              prev &&
              Math.abs(prev.x - b.x) < 0.01 &&
              Math.abs(prev.y - b.y) < 0.01 &&
              Math.abs(prev.width - b.width) < 0.01 &&
              Math.abs(prev.height - b.height) < 0.01
            ) {
              return prev;
            }
            return { x: b.x, y: b.y, width: b.width, height: b.height };
          });
        } catch {
          setBBox(null);
        }
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [id, project]);
  return bbox;
};

export const Canvas = () => {
  const root = useStore(s => s.project.root);
  const project = useStore(s => s.project);
  const viewBox = useStore(s => s.project.viewBox);
  const selectedId = useStore(s => s.ui.selectedNodeId);
  const { registerRef } = useTimeline();
  const bbox = useSelectionBBox(selectedId, project);

  const setRootRef = useCallback(
    (el: SVGSVGElement | null) => registerRef(root.id, el),
    [registerRef, root.id]
  );

  const onBgClick = () => actions.selectNode(null);

  return (
    <div className={styles.wrap} onClick={onBgClick}>
      <svg
        ref={setRootRef}
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className={styles.canvas}
        data-node-id={root.id}
      >
        {root.children.map(c => (
          <SvgNode key={c.id} node={c} />
        ))}
        {bbox && (
          <rect
            className={styles.selectionRect}
            x={bbox.x}
            y={bbox.y}
            width={bbox.width}
            height={bbox.height}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
};
