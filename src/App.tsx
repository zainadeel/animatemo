import { useEffect, useState } from 'react';
import { TimelineProvider } from '@/hooks/useTimeline';
import { Toolbar } from '@/components/Toolbar';
import { Layers } from '@/components/Layers';
import { Canvas } from '@/components/Canvas';
import { Inspector } from '@/components/Inspector';
import { Timeline } from '@/components/Timeline';
import { Toast } from '@/components/Toast';
import { actions, useStore } from '@/state/store';
import { parseSvg } from '@/lib/svgImport';
import styles from './App.module.css';

const App = () => {
  const theme = useStore(s => s.ui.theme);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const onImport = (markup: string) => {
    const parsed = parseSvg(markup);
    if (!parsed) {
      setToast('Invalid SVG');
      return;
    }
    for (const child of parsed.root.children) {
      actions.addNode('root', child);
    }
    const firstChild = parsed.root.children[0];
    if (firstChild) actions.selectNode(firstChild.id);
    setToast(`Imported · ${parsed.paths.length} path${parsed.paths.length === 1 ? '' : 's'}`);
  };

  return (
    <TimelineProvider>
      <div className={styles.shell}>
        <Toolbar onToast={setToast} onImportPaths={onImport} />
        <div className={styles.middle}>
          <Layers />
          <Canvas />
          <Inspector />
        </div>
        <Timeline />
        <Toast msg={toast} onDone={() => setToast(null)} />
      </div>
    </TimelineProvider>
  );
};

export default App;
