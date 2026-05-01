import { actions, useStore } from '@/state/store';
import { exportCode } from '@/lib/exporter';
import { exportSmilSvg } from '@/lib/smilExporter';
import styles from './Toolbar.module.css';

interface Props {
  onToast: (msg: string) => void;
  onOpenSequence: () => void;
}

export const Toolbar = ({ onToast, onOpenSequence }: Props) => {
  const loop = useStore(s => s.project.loop);
  const yoyo = useStore(s => s.project.yoyo);
  const duration = useStore(s => s.project.duration);
  const theme = useStore(s => s.ui.theme);
  const project = useStore(s => s.project);

  const onExportGsap = async () => {
    const code = exportCode(project);
    try {
      await navigator.clipboard.writeText(code);
      onToast('GSAP code copied to clipboard');
    } catch {
      onToast('Export failed');
    }
  };

  const onExportSvg = () => {
    try {
      const svg = exportSmilSvg(project);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'animatemo.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('SVG downloaded');
    } catch {
      onToast('SVG export failed');
    }
  };

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.logo}>AnimateMo</span>
        <button className={styles.btn} onClick={onOpenSequence}>
          Import
        </button>
        <button className={styles.btn} onClick={onExportGsap}>
          Export GSAP
        </button>
        <button className={styles.btn} onClick={onExportSvg}>
          Export SVG
        </button>
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
        <span className={styles.divider} />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Duration</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={duration}
            onChange={e => actions.scaleDuration(Number(e.target.value))}
            className={styles.fieldInput}
            title="changes duration and rescales all keyframes proportionally"
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
