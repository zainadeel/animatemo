import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/state/store';
import {
  buildProjectFromSequence,
  defaultTimes,
  naturalSort,
  type SequenceFrame,
} from '@/lib/svgSequence';
import type { AnimProject } from '@/state/types';
import styles from './SequenceImport.module.css';

interface FrameDraft {
  name: string;
  markup: string;
  time: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (project: AnimProject, summary: string) => void;
  onWarn: (msg: string) => void;
}

const DEFAULT_SPACING = 0.1;

export const SequenceImport = ({ open, onClose, onImported, onWarn }: Props) => {
  const fps = useStore(s => s.project.fps);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<FrameDraft[]>([]);
  const [spacing, setSpacing] = useState<number>(DEFAULT_SPACING);

  const lastTime = drafts.length > 0 ? Math.max(...drafts.map(d => d.time)) : 0;
  const totalTicks = Math.round(lastTime * fps);
  const inbetween =
    drafts.length >= 2 ? Math.max(0, totalTicks - (drafts.length - 1)) : 0;

  const summary = useMemo(() => {
    if (drafts.length === 0) return '';
    const dur = lastTime.toFixed(2);
    return `${drafts.length} frames · ${dur}s · ${fps}fps · ${inbetween} inbetween tick${inbetween === 1 ? '' : 's'}`;
  }, [drafts.length, lastTime, fps, inbetween]);

  if (!open) return null;

  const reset = () => {
    setDrafts([]);
    setSpacing(DEFAULT_SPACING);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const sortedNames = naturalSort(files.map(f => f.name));
    const sortedFiles = sortedNames
      .map(n => files.find(f => f.name === n))
      .filter((f): f is File => f != null);
    const markups = await Promise.all(sortedFiles.map(f => f.text()));
    const times = defaultTimes(sortedFiles.length, spacing);
    const next: FrameDraft[] = sortedFiles.map((f, i) => ({
      name: f.name,
      markup: markups[i],
      time: times[i],
    }));
    setDrafts(next);
  };

  const respaceAll = (next: number) => {
    setSpacing(next);
    if (drafts.length === 0) return;
    const times = defaultTimes(drafts.length, next);
    setDrafts(drafts.map((d, i) => ({ ...d, time: times[i] })));
  };

  const setTime = (idx: number, time: number) => {
    setDrafts(drafts.map((d, i) => (i === idx ? { ...d, time } : d)));
  };

  const removeAt = (idx: number) => {
    setDrafts(drafts.filter((_, i) => i !== idx));
  };

  const onConfirm = () => {
    if (drafts.length < 2) {
      onWarn('need at least 2 frames to tween');
      return;
    }
    const frames: SequenceFrame[] = drafts.map(d => ({
      name: d.name,
      markup: d.markup,
      time: d.time,
    }));
    const result = buildProjectFromSequence(frames, { fps });
    if (!result) {
      onWarn('could not parse sequence');
      return;
    }
    if (result.warnings.length > 0) {
      onWarn(result.warnings[0]);
    }
    const toastMsg = result.matchedIds.length > 0
      ? `imported ${drafts.length} frames · ${result.matchedIds.length} shape${result.matchedIds.length === 1 ? '' : 's'}`
      : `imported ${drafts.length} frames · no id matches — add ids in figma`;
    onImported(result.project, toastMsg);
    reset();
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={close}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.title}>import sequence</span>
          <button className={styles.close} onClick={close}>
            close
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>default spacing</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              className={styles.spacing}
              value={spacing}
              onChange={e => respaceAll(Number(e.target.value))}
            />
            <span className={styles.unit}>s/frame</span>
          </div>

          {drafts.length === 0 ? (
            <button className={styles.pick} onClick={() => fileRef.current?.click()}>
              pick svg files · multi-select
            </button>
          ) : (
            <>
              <div className={styles.list}>
                <div className={styles.listHead}>
                  <span>#</span>
                  <span>file</span>
                  <span style={{ textAlign: 'right' }}>time (s)</span>
                  <span />
                </div>
                {drafts.map((d, i) => (
                  <div key={`${d.name}-${i}`} className={styles.item}>
                    <span className={styles.idx}>{i + 1}</span>
                    <span className={styles.name} title={d.name}>{d.name}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={styles.timeInput}
                      value={d.time}
                      onChange={e => setTime(i, Number(e.target.value))}
                    />
                    <button
                      className={styles.remove}
                      onClick={() => removeAt(i)}
                      title="remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.summary}>{summary}</div>
              <div className={styles.row}>
                <button
                  className={styles.btn}
                  onClick={() => fileRef.current?.click()}
                >
                  add more
                </button>
              </div>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            multiple
            hidden
            onChange={onPick}
          />
        </div>

        <div className={styles.foot}>
          <button className={styles.btn} onClick={close}>
            cancel
          </button>
          <button
            className={`${styles.btn} ${styles.primary}`}
            disabled={drafts.length < 2}
            onClick={onConfirm}
          >
            replace scene
          </button>
        </div>
      </div>
    </div>
  );
};
