import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  projectName: string;
  onInviteClick: () => void;
  onDismiss: () => void;
}

export default function FirstInviteNudge({ open, projectName, onInviteClick, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = window.location.origin;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />
          <motion.div
            className="fixed left-1/2 top-1/2 z-[61] -translate-x-1/2 -translate-y-1/2 w-[420px] rounded-2xl p-6 text-center"
            style={{ background: 'rgba(20,10,35,0.98)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #00FFC8 0%, #7C3AED 100%)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0412" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>

            <h2 className="text-[20px] font-bold text-white mb-1.5">Nice — "{projectName}" is live.</h2>
            <p className="text-[14px] text-white/60 mb-5 leading-[1.5]">
              Ghost Session is built for collaboration. Pull in a producer friend so they can drop stems and jam with you in real time.
            </p>

            <div className="flex flex-col gap-2">
              <motion.button
                onClick={onInviteClick}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full h-11 rounded-full text-white text-[14px] font-semibold transition-all shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
                style={{ background: 'linear-gradient(180deg, #7C3AED 0%, #581C87 100%)' }}
              >
                Invite a collaborator
              </motion.button>

              <button
                onClick={handleCopyLink}
                className="w-full h-10 rounded-full text-[13px] font-medium border border-white/15 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/25 text-white/80 transition-all"
              >
                {copied ? 'Copied!' : 'Copy share link'}
              </button>

              <button
                onClick={onDismiss}
                className="text-[12px] text-white/40 hover:text-white/70 transition-colors mt-2"
              >
                I'll do this later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
