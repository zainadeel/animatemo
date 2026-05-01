import { actions, useStore } from '@/state/store';
import type { AnimNode } from '@/state/types';
import styles from './Layers.module.css';

interface RowProps {
  node: AnimNode;
  depth: number;
  selectedId: string | null;
}

const Row = ({ node, depth, selectedId }: RowProps) => {
  const isSelected = selectedId === node.id;
  return (
    <>
      <li
        className={`${styles.row} ${isSelected ? styles.selected : ''}`}
        onClick={() => actions.selectNode(node.id)}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <span className={styles.tag}>{node.tag}</span>
        <span className={styles.id}>{node.id}</span>
        {node.tracks.length > 0 && <span className={styles.dot} />}
        {node.id !== 'root' && (
          <button
            className={styles.del}
            onClick={e => {
              e.stopPropagation();
              actions.removeNode(node.id);
            }}
            aria-label="delete"
            title="delete"
          >
            ×
          </button>
        )}
      </li>
      {node.children.map(c => (
        <Row key={c.id} node={c} depth={depth + 1} selectedId={selectedId} />
      ))}
    </>
  );
};

export const Layers = () => {
  const root = useStore(s => s.project.root);
  const selectedId = useStore(s => s.ui.selectedNodeId);
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>layers</div>
      <ul className={styles.list}>
        <Row node={root} depth={0} selectedId={selectedId} />
      </ul>
    </aside>
  );
};
