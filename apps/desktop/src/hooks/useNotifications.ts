import { useState, useEffect } from 'react';
import type { Invitation, AppNotification } from '@ghost/types';
import { api } from '../lib/api';
import { API_BASE } from '../lib/constants';
import { useAuthStore } from '../stores/authStore';
import { devWarn } from '../lib/log';

export type { Invitation, AppNotification };

export function useNotifications() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
    totalCount: invitations.length + notifications.length + loopMessages.length,
  };
}
