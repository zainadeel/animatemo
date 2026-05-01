import { useRef, useState } from 'react';
import { actions, useStore } from '@/state/store';
import { useTimeline } from '@/hooks/useTimeline';
import { exportCode } from '@/lib/exporter';
import { parseSvg } from '@/lib/svgImport';
import styles from './Toolbar.module.css';

interface Props {
  onToast: (msg: string) => void;
  onImportPaths: (markup: string) => void;
}

export const Toolbar = ({ onToast, onImportPaths }: Props) => {
  const playing = useStore(s => s.ui.playing);
  const loop = useStore(s => s.project.loop);
  const yoyo = useStore(s => s.project.yoyo);
  const duration = useStore(s => s.project.duration);
  const theme = useStore(s => s.ui.theme);
  const project = useStore(s => s.project);
  const tl = useTimeline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showImport, setShowImport] = useState(false);
  const [paste, setPaste] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImportPaths(text);
    e.target.value = '';
  };

  const onExport = async () => {
    const code = exportCode(project);
    try {
      await navigator.clipboard.writeText(code);
      onToast('exported · copied to clipboard');
    } catch {
      onToast('export failed');
    }
  };

  const submitPaste = () => {
    if (!parseSvg(paste)) {
      onToast('invalid svg');
      return;
    }
    onImportPaths(paste);
    setPaste('');
    setShowImport(false);
  };

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.logo}>animatemo</span>
        <span className={styles.divider} />
        <button className={styles.btn} onClick={() => fileRef.current?.click()}>
          import file
        </button>
        <button className={styles.btn} onClick={() => setShowImport(v => !v)}>
          paste svg
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={onFile}
          hidden
        />
      </div>

      <div className={styles.center}>
        <button
          className={`${styles.btn} ${styles.play}`}
          onClick={tl.toggle}
          aria-label={playing ? 'pause' : 'play'}
        >
          {playing ? 'pause' : 'play'}
        </button>
        <label className={styles.field}>
          <span className={styles.label}>dur</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={duration}
            onChange={e => actions.setDuration(Number(e.target.value))}
            className={styles.input}
          />
          <span className={styles.unit}>s</span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={loop} onChange={e => actions.setLoop(e.target.checked)} />
          <span>loop</span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={yoyo} onChange={e => actions.setYoyo(e.target.checked)} />
          <span>yoyo</span>
        </label>
      </div>

      <div className={styles.right}>
        <button className={styles.btn} onClick={onExport}>
          export
        </button>
        <button
          className={styles.btn}
          onClick={() => actions.setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="toggle theme"
        >
          {theme === 'dark' ? 'light' : 'dark'}
        </button>
      </div>

      {showImport && (
        <div className={styles.popover}>
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            placeholder="<svg>...</svg>"
            className={styles.textarea}
            autoFocus
          />
          <div className={styles.popoverActions}>
            <button className={styles.btn} onClick={() => setShowImport(false)}>
              cancel
            </button>
            <button className={styles.btn} onClick={submitPaste}>
              import
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
