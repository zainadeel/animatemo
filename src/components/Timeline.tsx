import { useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { actions, useStore } from '@/state/store';
import type { AnimNode, Track } from '@/state/types';
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

export const Timeline = () => {
  const root = useStore(s => s.project.root);
  const duration = useStore(s => s.project.duration);
  const time = useStore(s => s.ui.time);
  const tl = useTimeline();
  const trackRef = useRef<HTMLDivElement>(null);
  const flat = useMemo(() => flatten(root), [root]);

  const fromPx = (x: number, width: number) => Math.max(0, Math.min(duration, (x / width) * duration));

  const onTrackClick = useCallback(
    (e: MouseEvent) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = fromPx(x, rect.width);
      tl.seek(t);
    },
    [tl]
  );

  const ticks = useMemo(() => {
    const step = duration <= 2 ? 0.25 : duration <= 5 ? 0.5 : 1;
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += step) out.push(Math.round(t * 1000) / 1000);
    return out;
  }, [duration]);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>timeline</span>
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
                    className={styles.kf}
                    style={{ left: `${(kf.time / duration) * 100}%` }}
                    onClick={e => {
                      e.stopPropagation();
                      actions.selectNode(node.id);
                      tl.seek(kf.time);
                    }}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      actions.removeKeyframe(node.id, track.prop, kf.id);
                    }}
                    title={`${kf.time.toFixed(2)}s · right-click to delete`}
                  />
                ))}
              </div>
            ))
          )}
          {flat.length === 0 && (
            <div className={styles.empty}>no tracks · select a layer and add keyframes</div>
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
