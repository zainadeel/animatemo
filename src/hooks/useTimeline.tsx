import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildTimeline } from '@/lib/compiler';
type Timeline = ReturnType<typeof buildTimeline>;
import { actions, useStore } from '@/state/store';

export interface TimelineApi {
  registerRef: (id: string, el: Element | null) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
}

const TimelineContext = createContext<TimelineApi | null>(null);

export const useTimeline = (): TimelineApi => {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('TimelineProvider missing');
  return ctx;
};

export const TimelineProvider = ({ children }: { children: ReactNode }) => {
  const project = useStore(s => s.project);
  const playing = useStore(s => s.ui.playing);
  const refsRef = useRef<Map<string, Element>>(new Map());
  const tlRef = useRef<Timeline | null>(null);
  const [refTick, setRefTick] = useState(0);

  const registerRef = useCallback((id: string, el: Element | null) => {
    const map = refsRef.current;
    if (el) {
      if (map.get(id) !== el) {
        map.set(id, el);
        setRefTick(t => t + 1);
      }
    } else if (map.has(id)) {
      map.delete(id);
      setRefTick(t => t + 1);
    }
  }, []);

  useEffect(() => {
    const prev = tlRef.current;
    const prevProgress = prev?.progress() ?? 0;
    prev?.kill();

    const tl = buildTimeline(project, refsRef.current);
    tlRef.current = tl;

    if (prevProgress > 0 && prevProgress < 1) tl.progress(prevProgress);
    if (playing) tl.play();

    return () => {
      tl.kill();
      if (tlRef.current === tl) tlRef.current = null;
    };
  }, [project, refTick, playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 33) {
        last = now;
        const tl = tlRef.current;
        if (tl) {
          const dur = Math.max(0.001, tl.duration());
          actions.setTime(tl.time() % dur);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const api = useMemo<TimelineApi>(
    () => ({
      registerRef,
      play: () => {
        actions.setPlaying(true);
      },
      pause: () => {
        actions.setPlaying(false);
      },
      toggle: () => {
        actions.setPlaying(!playing);
      },
      seek: (t: number) => {
        actions.setPlaying(false);
        actions.setTime(t);
        const tl = tlRef.current;
        if (tl) {
          tl.pause();
          tl.time(t);
        }
      },
    }),
    [playing, registerRef]
  );

  return <TimelineContext.Provider value={api}>{children}</TimelineContext.Provider>;
};
