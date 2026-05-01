import { useCallback, useMemo, type MouseEvent } from 'react';
import { useStore, actions } from '@/state/store';
import type { AnimNode } from '@/state/types';
import { useTimeline } from '@/hooks/useTimeline';
import styles from './Canvas.module.css';

const toCamel = (k: string): string =>
  k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const reactAttrs = (attrs: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
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
  selectedId: string | null;
}

const SvgNode = ({ node, selectedId }: NodeProps) => {
  const { registerRef } = useTimeline();
  const setRef = useCallback(
    (el: SVGElement | null) => registerRef(node.id, el),
    [registerRef, node.id]
  );

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    actions.selectNode(node.id);
  };

  const isSelected = selectedId === node.id;
  const className = isSelected ? styles.selected : undefined;

  const safeAttrs = useMemo(() => reactAttrs(node.attrs), [node.attrs]);

  const props = {
    ...safeAttrs,
    ref: setRef,
    onClick,
    className,
    'data-node-id': node.id,
  } as Record<string, unknown>;

  switch (node.tag) {
    case 'g':
      return <g {...props}>{node.children.map(c => <SvgNode key={c.id} node={c} selectedId={selectedId} />)}</g>;
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

export const Canvas = () => {
  const root = useStore(s => s.project.root);
  const viewBox = useStore(s => s.project.viewBox);
  const selectedId = useStore(s => s.ui.selectedNodeId);
  const { registerRef } = useTimeline();

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
          <SvgNode key={c.id} node={c} selectedId={selectedId} />
        ))}
      </svg>
    </div>
  );
};
