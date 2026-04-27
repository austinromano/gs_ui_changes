import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/**
 * Public read-only share modal. Toggle "anyone with the link" on/off and
 * copy the resulting URL. Mirrors Figma: zero-friction view links that
 * make it cheap to send a project to someone before they have an account.
 */
export default function ShareModal({
  open,
  onClose,
  projectId,
  projectName,
  initialShareToken,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialShareToken: string | null;
}) {
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset local state when the modal is reopened against a different project.
  useEffect(() => {
    if (open) {
      setShareToken(initialShareToken);
      setError(null);
      setCopied(false);
    }
  }, [open, initialShareToken]);

  if (!open) return null;

  const shareUrl = shareToken
    ? `${window.location.origin}/p/${shareToken}`
    : '';

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const { shareToken: token } = await api.enableShare(projectId);
      setShareToken(token);
    } catch (err: any) {
      setError(err?.message || 'Could not enable sharing');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.disableShare(projectId);
      setShareToken(null);
    } catch (err: any) {
      setError(err?.message || 'Could not disable sharing');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers (older WebView2) reject clipboard writes — fall back
      // to a hidden input + execCommand which is wider-supported.
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const enabled = !!shareToken;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,4,18,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-2xl glass glass-glow p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-white tracking-tight">Share project</h3>
            <p className="text-[12px] text-white/50 truncate">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] mb-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">Anyone with the link</div>
            <div className="text-[11px] text-white/50">Can view and listen — no account required</div>
          </div>
          <button
            onClick={enabled ? disable : enable}
            disabled={busy}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${enabled ? '' : 'bg-white/[0.1]'}`}
            style={enabled ? { background: 'linear-gradient(180deg, #7C3AED 0%, #581C87 100%)' } : undefined}
            aria-pressed={enabled}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: enabled ? '22px' : '2px' }}
            />
          </button>
        </div>

        {enabled && (
          <div className="flex gap-2 mb-4">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/80 font-mono outline-none focus:border-ghost-purple/60 transition-colors"
            />
            <button
              onClick={copy}
              className="px-4 rounded-lg text-[13px] font-semibold text-white transition-colors"
              style={{ background: 'linear-gradient(180deg, #7C3AED 0%, #581C87 100%)', boxShadow: '0 2px 8px rgba(124,58,237,0.4)' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg text-[12px] text-red-300" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        <p className="text-[11px] text-white/40 leading-relaxed">
          {enabled
            ? 'Anyone with this link can play the project but cannot edit, comment, or upload. Disable anytime to revoke access.'
            : 'Turn on to generate a link you can send anyone — they can play the project in their browser without signing in.'}
        </p>
      </div>
    </div>
  );
}
