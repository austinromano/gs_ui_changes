import { useEffect, useRef } from 'react';
import { sendCursorMove } from '../lib/socket';

export function useCursorTracking(
  containerRef: React.RefObject<HTMLElement>,
  projectId: string | null,
) {
  const lastEmit = useRef(0);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    const THROTTLE_MS = 50;

    const handleMouseMove = (e: MouseEvent) => {
      const pid = projectIdRef.current;
      if (!pid) return;

      const now = Date.now();
      if (now - lastEmit.current < THROTTLE_MS) return;
      lastEmit.current = now;

      // Use viewport-relative percentages so cursor maps consistently
      // regardless of window size or layout differences
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;

      sendCursorMove(pid, x, y);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);
}
