import { useState, useEffect, useMemo } from 'react';
import type { Invitation, AppNotification } from '@ghost/types';
import { api } from '../lib/api';
import { API_BASE } from '../lib/constants';
import { useAuthStore } from '../stores/authStore';
import { devWarn } from '../lib/log';

export type { Invitation, AppNotification };

const BELL_SEEN_KEY = 'ghost_bell_seen_at';
const INBOX_SEEN_KEY = 'ghost_inbox_seen_at';

function readSeenAt(key: string): number {
  const raw = localStorage.getItem(key);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function isLoop(n: AppNotification) {
  return n.type === 'loop' || n.message.includes('🎵');
}

export function useNotifications() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bellSeenAt, setBellSeenAt] = useState<number>(() => readSeenAt(BELL_SEEN_KEY));
  const [inboxSeenAt, setInboxSeenAt] = useState<number>(() => readSeenAt(INBOX_SEEN_KEY));

  const fetchInvitations = async () => {
    try {
      const res = await fetch(API_BASE + '/invitations', { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } });
      const json = await res.json();
      if (json.data) setInvitations(json.data);
    } catch (err) { devWarn('useNotifications.fetchInvitations', err); }
  };

  const fetchNotifications = async () => {
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) { devWarn('useNotifications.fetchNotifications', err); }
  };

  const acceptInvite = async (id: string): Promise<string | null> => {
    try {
      const inv = invitations.find(i => i.id === id);
      await fetch(API_BASE + `/invitations/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: '{}',
      });
      fetchInvitations();
      return (inv as any)?.projectId || null;
    } catch (err) { devWarn('useNotifications.acceptInvite', err); return null; }
  };

  const declineInvite = async (id: string) => {
    try {
      await fetch(API_BASE + `/invitations/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: '{}',
      });
      fetchInvitations();
    } catch (err) { devWarn('useNotifications.declineInvite', err); }
  };

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications([]);
    } catch (err) { devWarn('useNotifications.markAllRead', err); }
  };

  // Initial load + polling
  useEffect(() => {
    fetchInvitations();
    fetchNotifications();
    const poll = setInterval(() => { fetchInvitations(); fetchNotifications(); }, 10000);
    return () => clearInterval(poll);
  }, []);

  const [loopMessages, setLoopMessages] = useState<{ id: string; from: string; loopName: string; timestamp: string }[]>([]);

  const addLoopMessage = (from: string, loopName: string) => {
    setLoopMessages(prev => [...prev, { id: Date.now().toString(), from, loopName, timestamp: new Date().toISOString() }]);
  };

  const removeLoopMessage = (id: string) => {
    setLoopMessages(prev => prev.filter(m => m.id !== id));
  };

  // Listen for loop-sent events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.from && detail?.loopName) {
        addLoopMessage(detail.from, detail.loopName);
      }
    };
    window.addEventListener('ghost-loop-sent', handler);
    return () => window.removeEventListener('ghost-loop-sent', handler);
  }, []);

  // Unread counts: items newer than the last time the user opened that popup.
  // Keeps invitations/notifications visible in the popup but clears the badge.
  const bellUnreadCount = useMemo(() => {
    const newInvites = invitations.filter((inv) => {
      const ts = inv.createdAt ? Date.parse(inv.createdAt) : 0;
      return ts > bellSeenAt;
    }).length;
    const newChats = notifications.filter((n) => {
      if (isLoop(n)) return false;
      return Date.parse(n.createdAt) > bellSeenAt;
    }).length;
    return newInvites + newChats;
  }, [invitations, notifications, bellSeenAt]);

  const inboxUnreadCount = useMemo(() => {
    const newServerLoops = notifications.filter((n) => {
      if (!isLoop(n)) return false;
      return Date.parse(n.createdAt) > inboxSeenAt;
    }).length;
    const newLocalLoops = loopMessages.filter((lm) => Date.parse(lm.timestamp) > inboxSeenAt).length;
    return newServerLoops + newLocalLoops;
  }, [notifications, loopMessages, inboxSeenAt]);

  const markBellSeen = () => {
    const now = Date.now();
    localStorage.setItem(BELL_SEEN_KEY, String(now));
    setBellSeenAt(now);
    markAllRead();
  };

  const markInboxSeen = () => {
    const now = Date.now();
    localStorage.setItem(INBOX_SEEN_KEY, String(now));
    setInboxSeenAt(now);
  };

  return {
    invitations,
    notifications,
    loopMessages,
    addLoopMessage,
    removeLoopMessage,
    fetchInvitations,
    fetchNotifications,
    acceptInvite,
    declineInvite,
    markAllRead,
    bellUnreadCount,
    inboxUnreadCount,
    markBellSeen,
    markInboxSeen,
    totalCount: invitations.length + notifications.length + loopMessages.length,
  };
}
