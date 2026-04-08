import { useState, useEffect } from 'react';
import type { Invitation, AppNotification } from '@ghost/types';
import { api } from '../lib/api';
import { API_BASE } from '../lib/constants';
import { useAuthStore } from '../stores/authStore';

export type { Invitation, AppNotification };

export function useNotifications() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchInvitations = async () => {
    try {
      const res = await fetch(API_BASE + '/invitations', { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } });
      const json = await res.json();
      if (json.data) setInvitations(json.data);
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch {}
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
    } catch { return null; }
  };

  const declineInvite = async (id: string) => {
    try {
      await fetch(API_BASE + `/invitations/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: '{}',
      });
      fetchInvitations();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications([]);
    } catch {}
  };

  // Initial load + polling
  useEffect(() => {
    fetchInvitations();
    fetchNotifications();
    const poll = setInterval(() => { fetchInvitations(); fetchNotifications(); }, 10000);
    return () => clearInterval(poll);
  }, []);

  return {
    invitations,
    notifications,
    fetchInvitations,
    fetchNotifications,
    acceptInvite,
    declineInvite,
    markAllRead,
    totalCount: invitations.length + notifications.length,
  };
}
