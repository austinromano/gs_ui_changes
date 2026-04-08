import { useState, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';
import Avatar from './Avatar';

export default function SettingsPopup({ user, onSignOut, onDeleteAccount, onClose, onProfile }: { user: any; onSignOut: () => void; onDeleteAccount: () => void; onClose: () => void; onProfile?: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const { avatarUrl } = await api.uploadAvatar(file);
      const updated = { ...user, avatarUrl };
      useAuthStore.setState({ user: updated });
      localStorage.setItem('ghost_user', JSON.stringify(updated));
    } catch {}
    setUploading(false);
  };

  return (
    <div className="absolute right-2 top-12 w-56 bg-[#111214] rounded-lg shadow-popup animate-popup z-50 p-2 border border-white/5">
      <div className="p-2 mb-1">
        <div className="flex items-center gap-2.5">
          <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
            <Avatar name={user?.displayName || '?'} src={user?.avatarUrl} size="lg" />
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <span className="text-[9px] text-white font-bold">...</span>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ghost-text-primary">{user?.displayName || 'Unknown'}</p>
            <p className="text-[12px] text-ghost-text-muted">{user?.email || ''}</p>
          </div>
        </div>
      </div>
      <div className="h-px bg-white/5 mx-1 mb-1" />
      <button
        onClick={() => { onClose(); if (onProfile) onProfile(); }}
        className="w-full px-2 py-1.5 text-[13px] text-left rounded text-ghost-text-secondary hover:bg-ghost-surface-hover hover:text-white transition-colors"
      >
        My Profile
      </button>
      <button
        onClick={onSignOut}
        className="w-full px-2 py-1.5 text-[13px] text-left rounded text-ghost-text-secondary hover:bg-ghost-error-red hover:text-white transition-colors"
      >
        Sign Out
      </button>
      <div className="h-px bg-white/5 mx-1 my-1" />
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full px-2 py-1.5 text-[13px] text-left rounded text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Delete Account
        </button>
      ) : (
        <div className="p-2 space-y-2">
          <p className="text-[12px] text-red-400">Are you sure? This is permanent.</p>
          <div className="flex gap-2">
            <button onClick={onDeleteAccount} className="flex-1 px-2 py-1 text-[12px] rounded bg-red-500 text-white hover:bg-red-600 transition-colors">Yes, Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="flex-1 px-2 py-1 text-[12px] rounded bg-white/10 text-ghost-text-secondary hover:bg-white/15 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
