import { useEffect, type RefObject } from 'react';

/**
 * Calls `handler` when a mousedown occurs outside all provided refs.
 * Supports optional portal selector — clicks inside portaled elements won't trigger close.
 */
export function useOutsideClick(
  refs: RefObject<HTMLElement | null>[],
  handler: () => void,
  active: boolean,
  portalSelector?: string,
) {
  useEffect(() => {
    if (!active) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;

      for (const ref of refs) {
        if (ref.current && ref.current.contains(target)) return;
      }

      if (portalSelector) {
        const portal = document.querySelector(portalSelector);
        if (portal && portal.contains(target)) return;
      }

      handler();
    };

    // Defer so the click that opened the menu doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', onMouseDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [active, handler, portalSelector, ...refs]);
}
