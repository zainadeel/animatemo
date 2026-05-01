import { useRef } from 'react';
import { actions, useStore } from '@/state/store';
import { exportCode } from '@/lib/exporter';
import styles from './Toolbar.module.css';

interface Props {
  onToast: (msg: string) => void;
  onImportPaths: (markup: string) => void;
}

export const Toolbar = ({ onToast, onImportPaths }: Props) => {
  const loop = useStore(s => s.project.loop);
  const yoyo = useStore(s => s.project.yoyo);
  const duration = useStore(s => s.project.duration);
  const theme = useStore(s => s.ui.theme);
  const project = useStore(s => s.project);
  const fileRef = useRef<HTMLInputElement>(null);

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
      onToast('Exported · copied to clipboard');
    } catch {
      onToast('Export failed');
    }
  };

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.logo}>animatemo</span>
        <button className={styles.btn} onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <button className={styles.btn} onClick={onExport}>
          Export
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
          className={`${styles.btn} ${loop ? styles.active : ''}`}
          onClick={() => actions.setLoop(!loop)}
        >
          Loop
        </button>
        <button
          className={`${styles.btn} ${yoyo ? styles.active : ''}`}
          onClick={() => actions.setYoyo(!yoyo)}
        >
          Yoyo
        </button>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Duration</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={duration}
            onChange={e => actions.setDuration(Number(e.target.value))}
            className={styles.fieldInput}
          />
          <span className={styles.fieldUnit}>s</span>
        </label>
      </div>

      <div className={styles.right}>
        <div className={styles.textToggle} role="group" aria-label="Color theme">
          <button
            className={`${styles.btn} ${theme === 'light' ? styles.active : ''}`}
            onClick={() => actions.setTheme('light')}
          >
            Light
          </button>
          <button
            className={`${styles.btn} ${theme === 'dark' ? styles.active : ''}`}
            onClick={() => actions.setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>
    </header>
  );
};
