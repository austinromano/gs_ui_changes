import type { Invitation, AppNotification } from '@ghost/types';

export type { Invitation, AppNotification as Notification };

export default function NotificationPopup({ invitations, onAccept, onDecline, notifications, onMarkRead }: {
  invitations: Invitation[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  notifications: AppNotification[];
  onMarkRead: () => void;
}) {
  return (
    <div className="absolute right-14 top-12 w-80 bg-[#111214] rounded-lg shadow-popup animate-popup z-50 border border-white/5 max-h-80 overflow-y-auto">
      {invitations.length > 0 && (
        <>
          <div className="p-3 pb-1">
            <span className="text-[12px] font-semibold text-ghost-text-secondary uppercase tracking-wide">Invitations</span>
          </div>
          <div>
            {invitations.map((inv) => (
              <div key={inv.id} className="p-3 border-b border-ghost-border/50">
                <p className="text-xs font-bold text-ghost-green">{inv.inviterName}</p>
                <p className="text-[10px] text-ghost-text-muted mt-0.5">invited you to <span className="text-ghost-text-secondary">{inv.projectName}</span></p>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => onAccept(inv.id)} className="px-3 py-1 text-[10px] font-semibold bg-ghost-green/10 text-ghost-green border border-ghost-green/30 rounded hover:bg-ghost-green/20">Accept</button>
                  <button onClick={() => onDecline(inv.id)} className="px-2 py-1 text-[10px] font-semibold text-ghost-text-muted hover:text-ghost-error-red">X</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {notifications.length > 0 && (
        <>
          <div className="p-3 pb-1 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ghost-text-secondary uppercase tracking-wide">Messages</span>
            <button onClick={onMarkRead} className="text-[11px] text-ghost-purple hover:text-ghost-purple/80 font-medium">Mark all read</button>
          </div>
          <div>
            {notifications.map((n) => (
              <div key={n.id} className="px-3 py-2 border-b border-ghost-border/50 flex gap-2 items-start">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5865F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ghost-text-secondary leading-snug">{n.message}</p>
                  <p className="text-[10px] text-ghost-text-muted mt-0.5">
                    {new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {invitations.length === 0 && notifications.length === 0 && (
        <div className="p-4 text-center text-[13px] text-ghost-text-muted italic">No new notifications</div>
      )}
    </div>
  );
}

export function BellIcon({ count }: { count: number }) {
  return (
    <div className="relative">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </div>
  );
}
