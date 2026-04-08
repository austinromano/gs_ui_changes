import { useState, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOutsideClick } from '../../hooks/useOutsideClick';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  className?: string;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  portalSelector?: string;
  children?: ReactNode;
}

export default function ContextMenu({ items, portalSelector }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(
    [btnRef, menuRef],
    () => setOpen(false),
    open,
    portalSelector,
  );

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(v => !v);
  }, []);

  const menuContent = open && btnRef.current ? (
    <div
      ref={menuRef}
      data-context-menu-portal
      className="fixed w-40 glass animate-popup z-50 py-1 rounded-lg"
      style={{
        top: btnRef.current.getBoundingClientRect().bottom + 4,
        left: btnRef.current.getBoundingClientRect().right - 160,
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); setOpen(false); }}
          className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-white/10 transition-colors ${
            item.danger ? 'text-red-400' : item.className || 'text-white/80'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
          <circle cx="12" cy="5" r="2.5" />
          <circle cx="12" cy="12" r="2.5" />
          <circle cx="12" cy="19" r="2.5" />
        </svg>
      </button>
      {menuContent && createPortal(menuContent, document.body)}
    </>
  );
}
