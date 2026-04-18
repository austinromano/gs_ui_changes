import { useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useAuthStore } from '../../stores/authStore';
import ChatMessages from './ChatMessages';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';

export default function ChatPanel() {
  const { chatMessages, sendMessage, deleteMessage, onlineUsers } = useSessionStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGifs, setShowGifs] = useState(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText('');
  };

  const sendGif = (url: string) => {
    sendMessage(`[gif]${url}[/gif]`);
    setShowGifs(false);
  };

  const toggleGifs = () => {
    setShowGifs((v) => !v);
    setShowEmoji(false);
  };

  const toggleEmoji = () => {
    setShowEmoji((v) => !v);
    setShowGifs(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ChatMessages
        messages={chatMessages}
        onlineUsers={onlineUsers}
        currentUserId={currentUserId}
        onDelete={deleteMessage}
      />

      <div className="px-3 pb-3 pt-1 relative shrink-0">
        {showEmoji && (
          <EmojiPicker
            onPick={(emoji) => { setText((prev) => prev + emoji); setShowEmoji(false); }}
            onClose={() => setShowEmoji(false)}
          />
        )}
        {showGifs && <GifPicker onSelect={sendGif} />}

        <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.08]">
          <input
            className="flex-1 min-w-0 bg-transparent text-[14px] text-ghost-text-primary placeholder:text-ghost-text-muted pl-3 py-2.5 pr-2 outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message..."
          />
          <button
            onClick={toggleGifs}
            className={`shrink-0 w-8 h-8 flex items-center justify-center transition-colors rounded text-[11px] font-bold ${showGifs ? 'text-ghost-green' : 'text-ghost-text-muted hover:text-ghost-text-primary'}`}
          >
            GIF
          </button>
          <button
            onClick={toggleEmoji}
            className={`shrink-0 w-8 h-8 flex items-center justify-center transition-colors rounded ${showEmoji ? 'text-ghost-green' : 'text-ghost-text-muted hover:text-ghost-text-primary'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-4-9a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm-5.5 3.5a.75.75 0 0 1 1.06.02A4.47 4.47 0 0 0 12 16a4.47 4.47 0 0 0 3.44-1.48.75.75 0 1 1 1.08 1.04A5.97 5.97 0 0 1 12 17.5a5.97 5.97 0 0 1-4.52-1.94.75.75 0 0 1 .02-1.06z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
