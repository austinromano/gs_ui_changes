import { useEffect, useRef } from 'react';

const SMILEYS = ['😀','😂','😍','🥳','😎','🤩','🥰','😭','🔥','💀','👀','💯','🎵','🎶','🎤','🎧','🎸','🥁','🎹','👻','✨'];
const HANDS = ['👍','👎','👏','🙌','🤝','✌️','🤟','🤙','💪','🫶','👊','✊','🫡','🎉'];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const renderGroup = (label: string, items: string[]) => (
    <>
      <div className="text-[10px] font-semibold text-ghost-text-muted uppercase tracking-wider px-1 pb-1.5">{label}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {items.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onPick(emoji)}
            className="w-7 h-7 flex items-center justify-center text-base hover:bg-ghost-surface-hover rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div
      ref={ref}
      className="absolute bottom-14 right-2 w-[220px] bg-[#111214] border border-ghost-border rounded-lg shadow-popup animate-popup p-2 z-50"
    >
      {renderGroup('Smileys', SMILEYS)}
      <div className="pt-2">{renderGroup('Hands', HANDS)}</div>
    </div>
  );
}
