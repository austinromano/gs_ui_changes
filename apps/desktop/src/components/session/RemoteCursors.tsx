import { useEffect } from 'react';
import { useSessionStore } from '../../stores/sessionStore';

const STALE_MS = 5000;

export default function RemoteCursors() {
  const remoteCursors = useSessionStore((s) => s.remoteCursors);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      useSessionStore.setState((s) => {
        let changed = false;
        const next = new Map(s.remoteCursors);
        for (const [uid, cursor] of next) {
          if (now - cursor.timestamp > STALE_MS) {
            next.delete(uid);
            changed = true;
          }
        }
        return changed ? { remoteCursors: next } : s;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {Array.from(remoteCursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          className="pointer-events-none absolute z-50"
          style={{
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            transform: 'translate(-2px, -2px)',
            transition: 'left 75ms ease-out, top 75ms ease-out',
          }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill={cursor.colour} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <path d="M0 0 L0 16 L4.5 11.5 L8.5 19 L11 18 L7 10.5 L13 10.5 Z" />
          </svg>
          <span
            className="absolute left-4 top-3 text-[11px] font-medium text-white px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ backgroundColor: cursor.colour, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
          >
            {cursor.displayName}
          </span>
        </div>
      ))}
    </>
  );
}
