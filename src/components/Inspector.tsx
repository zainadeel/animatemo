import { useState } from 'react';
import { actions, findNodeById, findTrack, useStore } from '@/state/store';
import { NUMERIC_PROPS, PROP_KEYS, type PropKey } from '@/state/types';
import styles from './Inspector.module.css';

const findKfAtTime = (kfs: { id: string; time: number; value: number | string }[], t: number) =>
  kfs.find(k => Math.abs(k.time - t) < 0.05);

const valueAtTime = (
  kfs: { time: number; value: number | string }[],
  t: number,
  fallback: string
): string => {
  if (kfs.length === 0) return fallback;
  const sorted = [...kfs].sort((a, b) => a.time - b.time);
  if (t <= sorted[0].time) return String(sorted[0].value);
  if (t >= sorted[sorted.length - 1].time) return String(sorted[sorted.length - 1].value);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].time && t <= sorted[i + 1].time) return String(sorted[i].value);
  }
  return fallback;
};

interface RowProps {
  nodeId: string;
  prop: PropKey;
  time: number;
  recording: boolean;
  initial: string;
}

const PropRow = ({ nodeId, prop, time, recording, initial }: RowProps) => {
  const node = findNodeById(nodeId);
  if (!node) return null;
  const track = findTrack(node, prop);
  const kfs = track?.keyframes ?? [];
  const atTime = findKfAtTime(kfs, time);
  const display = atTime ? String(atTime.value) : valueAtTime(kfs, time, initial);
  const [draft, setDraft] = useState<string | null>(null);
  const isNumeric = NUMERIC_PROPS.includes(prop);

  const commit = (raw: string) => {
    const value: number | string = isNumeric ? Number(raw) : raw;
    if (atTime) {
      // Always update an existing keyframe at this time
      actions.updateKeyframe(nodeId, prop, atTime.id, { value });
    } else if (recording) {
      // Auto-keyframe only when recording
      actions.addKeyframe(nodeId, prop, time, value);
    } else if (kfs.length === 0) {
      // No keyframes yet — apply as initial node attr (so the user can stage values before recording)
      const attrName =
        prop === 'd' || prop === 'fill' || prop === 'stroke' ? prop : null;
      if (attrName) actions.setNodeAttr(nodeId, attrName, raw);
    }
    setDraft(null);
  };

  const onAdd = () => {
    const value: number | string = isNumeric ? Number(display) || 0 : display;
    actions.addKeyframe(nodeId, prop, time, value);
  };

  const onRemove = () => {
    if (atTime) actions.removeKeyframe(nodeId, prop, atTime.id);
  };

  return (
    <div className={styles.row}>
      <span className={styles.propLabel}>{prop}</span>
      <input
        type={isNumeric ? 'number' : 'text'}
        step={isNumeric ? '0.1' : undefined}
        value={draft ?? display}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => {
          if (e.target.value !== display) commit(e.target.value);
          else setDraft(null);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
        className={`${styles.input} ${prop === 'd' ? styles.long : ''}`}
      />
      <span className={styles.kfCount} title={`${kfs.length} keyframes`}>
        {kfs.length}
      </span>
      {atTime ? (
        <button className={styles.kfBtn} onClick={onRemove} title="remove keyframe at current time">
          −
        </button>
      ) : (
        <button className={styles.kfBtn} onClick={onAdd} title="add keyframe at current time">
          +
        </button>
      )}
    </div>
  );
};

const initialFor = (
  prop: PropKey,
  attrs: Record<string, string>
): string => {
  switch (prop) {
    case 'x':
    case 'y':
    case 'rotation':
      return '0';
    case 'scale':
    case 'opacity':
      return '1';
    case 'fill':
      return attrs.fill ?? '#000000';
    case 'stroke':
      return attrs.stroke ?? '#000000';
    case 'd':
      return attrs.d ?? '';
  }
};

export const Inspector = () => {
  const selectedId = useStore(s => s.ui.selectedNodeId);
  const recording = useStore(s => s.ui.recording);
  const time = useStore(s => s.ui.time);
  const node = useStore(s => (s.ui.selectedNodeId ? findNodeById(s.ui.selectedNodeId) : null));

  if (!selectedId || !node) {
    return (
      <aside className={styles.panel}>
        <div className={styles.header}>
          <span>Inspector</span>
        </div>
        <div className={styles.empty}>Select a layer</div>
      </aside>
    );
  }

  const isPath = node.tag === 'path';
  const props = PROP_KEYS.filter(p => p !== 'd' || isPath);

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span>Inspector</span>
        <button
          className={`${styles.recBtn} ${recording ? styles.recOn : ''}`}
          onClick={() => actions.setRecording(!recording)}
          title="Record mode"
        >
          <span className={styles.recDot} />
          Rec
        </button>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Node</div>
        <div className={styles.metaRow}>
          <span className={styles.propLabel}>Tag</span>
          <span className={styles.metaVal}>{node.tag}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.propLabel}>Id</span>
          <span className={styles.metaVal}>{node.id}</span>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Properties · t = {time.toFixed(2)}s</div>
        {props.map(p => (
          <PropRow
            key={p}
            nodeId={selectedId}
            prop={p}
            time={time}
            recording={recording}
            initial={initialFor(p, node.attrs)}
          />
        ))}
      </div>
    </aside>
  );
};
