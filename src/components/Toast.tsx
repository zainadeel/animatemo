import { useEffect } from 'react';
import styles from './Toast.module.css';

export const Toast = ({ msg, onDone }: { msg: string | null; onDone: () => void }) => {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [msg, onDone]);

  if (!msg) return null;
  return <div className={styles.toast}>{msg}</div>;
};
