import { actions, useStore } from '@/state/store';
import type { AnimNode } from '@/state/types';
import styles from './Layers.module.css';

interface RowProps {
  node: AnimNode;
  selectedId: string | null;
}

const Row = ({ node, selectedId }: RowProps) => {
  const isSelected = selectedId === node.id;
  const isRoot = node.id === 'root';
  return (
    <>
      <li
        className={`${styles.row} ${isSelected ? styles.selected : ''} ${isRoot ? styles.rootRow : ''}`}
        onClick={() => actions.selectNode(node.id)}
        title={isRoot ? 'The root SVG container holding all imported shapes.' : undefined}
      >
        <span className={styles.tag}>{node.tag}</span>
        <span className={styles.id}>{node.id}</span>
      </li>
      {node.children.map(c => (
        <Row key={c.id} node={c} selectedId={selectedId} />
      ))}
    </>
  );
};

export const Layers = () => {
  const root = useStore(s => s.project.root);
  const selectedId = useStore(s => s.ui.selectedNodeId);
  return (
    <aside className={styles.panel}>
      <div className={styles.header}>Layers</div>
      <ul className={styles.list}>
        <Row node={root} selectedId={selectedId} />
      </ul>
    </aside>
  );
};
