import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { actions, useStore } from '@/state/store';
import type { AnimNode, PropKey, Track } from '@/state/types';
import { useTimeline } from '@/hooks/useTimeline';
import styles from './Timeline.module.css';

interface NodeTracks {
  node: AnimNode;
  tracks: Track[];
}

const flatten = (root: AnimNode): NodeTracks[] => {
  const out: NodeTracks[] = [];
  const walk = (n: AnimNode) => {
    if (n.tracks.length > 0) out.push({ node: n, tracks: n.tracks });
    n.children.forEach(walk);
  };
  walk(root);
  return out;
};

interface DragState {
  kfId: string;
  nodeId: string;
  prop: PropKey;
  pointerId: number;
  moved: boolean;
}

export const Timeline = () => {
  const root = useStore(s => s.project.root);
  const duration = useStore(s => s.project.duration);
  const time = useStore(s => s.ui.time);
  const tl = useTimeline();
  const trackRef = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => flatten(root), [root]);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const fromPx = useCallback(
    (x: number, width: number) => Math.max(0, Math.min(duration, (x / width) * duration)),
    [duration]
  );

  const onTrackClick = useCallback(
    (e: MouseEvent) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = fromPx(x, rect.width);
      tl.seek(t);
    },
    [tl, fromPx]
  );

  const ticks = useMemo(() => {
    const step = duration <= 2 ? 0.25 : duration <= 5 ? 0.5 : 1;
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += step) out.push(Math.round(t * 1000) / 1000);
    return out;
  }, [duration]);

  const playing = useStore(s => s.ui.playing);

  const onKfPointerDown = (
    e: PointerEvent<HTMLButtonElement>,
    nodeId: string,
    prop: PropKey,
    kfId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { kfId, nodeId, prop, pointerId: e.pointerId, moved: false };
    setDraggingId(kfId);
  };

  // Track drag globally on document so pointer can leave the keyframe diamond
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const stripEl = trackRef.current;
      if (!stripEl) return;
      const rect = stripEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = Math.round(fromPx(x, rect.width) * 1000) / 1000;
      drag.moved = true;
      actions.updateKeyframe(drag.nodeId, drag.prop, drag.kfId, { time: t });
      actions.setTime(t);
    };
    const onUp = () => {
      dragRef.current = null;
      setDraggingId(null);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId, fromPx]);

  const onKfClick = (e: MouseEvent<HTMLButtonElement>, nodeId: string, kfTime: number) => {
    e.stopPropagation();
    // Suppress click if a drag actually moved the keyframe
    if (dragRef.current?.moved) return;
    actions.selectNode(nodeId);
    tl.seek(kfTime);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <button className={styles.playBtn} onClick={tl.toggle}>
          {playing ? 'Pause animation' : 'Play animation'}
        </button>
        <span className={styles.time}>
          {time.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.rulerLabel} />
          {flat.flatMap(({ node, tracks }) =>
            tracks.map(t => (
              <div
                key={`${node.id}-${t.prop}`}
                className={styles.trackLabel}
                onClick={() => actions.selectNode(node.id)}
              >
                <span className={styles.trackId}>{node.id}</span>
                <span className={styles.trackProp}>{t.prop}</span>
              </div>
            ))
          )}
        </div>
        <div className={styles.tracks} ref={trackRef} onClick={onTrackClick}>
          <div className={styles.ruler}>
            {ticks.map(t => (
              <div key={t} className={styles.tick} style={{ left: `${(t / duration) * 100}%` }}>
                <span className={styles.tickLabel}>{t}</span>
              </div>
            ))}
          </div>
          {flat.flatMap(({ node, tracks }) =>
            tracks.map(track => (
              <div key={`${node.id}-${track.prop}`} className={styles.trackRow}>
                {track.keyframes.map(kf => (
                  <button
                    key={kf.id}
                    className={`${styles.kf} ${draggingId === kf.id ? styles.kfDragging : ''}`}
                    style={{ left: `${(kf.time / duration) * 100}%` }}
                    onPointerDown={e => onKfPointerDown(e, node.id, track.prop, kf.id)}
                    onClick={e => onKfClick(e, node.id, kf.time)}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      actions.removeKeyframe(node.id, track.prop, kf.id);
                    }}
                    title={`${kf.time.toFixed(2)}s · drag to retime · right-click to delete`}
                  />
                ))}
              </div>
            ))
          )}
          {flat.length === 0 && (
            <div className={styles.empty}>No tracks · select a layer and add keyframes</div>
          )}
          <div
            className={styles.playhead}
            style={{ left: `${(time / Math.max(0.001, duration)) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
};
