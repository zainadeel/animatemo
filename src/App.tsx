import { useEffect, useState } from 'react';
import { TimelineProvider } from '@/hooks/useTimeline';
import { Toolbar } from '@/components/Toolbar';
import { Layers } from '@/components/Layers';
import { Canvas } from '@/components/Canvas';
import { Timeline } from '@/components/Timeline';
import { Toast } from '@/components/Toast';
import { SequenceImport } from '@/components/SequenceImport';
import { actions, useStore } from '@/state/store';
import styles from './App.module.css';

const App = () => {
  const theme = useStore(s => s.ui.theme);
  const [toast, setToast] = useState<string | null>(null);
  const [sequenceOpen, setSequenceOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <TimelineProvider>
      <div className={styles.shell}>
        <Toolbar
          onToast={setToast}
          onOpenSequence={() => setSequenceOpen(true)}
        />
        <div className={styles.middle}>
          <Layers />
          <Canvas />
        </div>
        <Timeline />
        <Toast msg={toast} onDone={() => setToast(null)} />
        <SequenceImport
          open={sequenceOpen}
          onClose={() => setSequenceOpen(false)}
          onImported={(project, summary) => {
            actions.replaceProject(project);
            setToast(summary);
          }}
          onWarn={msg => setToast(msg)}
        />
      </div>
    </TimelineProvider>
  );
};

export default App;
