import { create } from 'zustand';
import { api, type Booking } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useProjectStore } from './projectStore';
import { useAuthStore } from './authStore';

interface BookingsState {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  // Xbox-style toast queue: incoming invites (pending, addressed to me)
  // land here and a global toast renders the head of the queue.
  inviteQueue: Booking[];
  bootstrap: () => Promise<void>;
  create: (input: { inviteeId: string; title?: string; scheduledAt: string; durationMin: number }) => Promise<Booking>;
  accept: (id: string) => Promise<void>;
  decline: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  dismissInvite: (id: string) => void;
}

let socketHandlerAttached = false;

export const useBookingsStore = create<BookingsState>((set, get) => ({
  bookings: [],
  loading: false,
  error: null,
  inviteQueue: [],

  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const list = await api.listBookings();
      set({ bookings: list, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load bookings', loading: false });
    }

    // Subscribe once to realtime booking events so both participants see
    // create/update/delete without a manual reload.
    const socket = getSocket();
    if (socket && !socketHandlerAttached) {
      socket.on('booking-updated', (payload) => {
        const current = get().bookings;
        if (payload.kind === 'deleted') {
          // Booking gone → drop it from state and pull a fresh projects
          // list so any auto-created shared project that the server
          // cleaned up disappears from the sidebar too.
          const gone = current.find((b) => b.id === payload.bookingId);
          set({
            bookings: current.filter((b) => b.id !== payload.bookingId),
            inviteQueue: get().inviteQueue.filter((b) => b.id !== payload.bookingId),
          });
          if (gone?.projectId) useProjectStore.getState().fetchProjects();
          return;
        }
        const booking = payload.booking as Booking | undefined;
        if (!booking) return;
        const prev = current.find((b) => b.id === payload.bookingId);
        const idx = current.findIndex((b) => b.id === payload.bookingId);
        if (idx === -1) set({ bookings: [booking, ...current] });
        else {
          const next = [...current];
          next[idx] = booking;
          set({ bookings: next });
        }

        // When a booking is canceled and its shared project was torn down,
        // pull a fresh projects list so the sidebar drops the stale room.
        if (booking.status === 'canceled' && prev?.projectId) {
          useProjectStore.getState().fetchProjects();
        }

        // Enqueue a toast for invites addressed to me that are still pending.
        // On kind='created' from the server we always push; on 'updated' we
        // only push if the status flipped to pending (rare, e.g. reschedule).
        const me = useAuthStore.getState().user?.id;
        const isForMe = !!me && booking.inviteeId === me;
        if (payload.kind === 'created' && isForMe && booking.status === 'pending') {
          const queue = get().inviteQueue;
          if (!queue.some((b) => b.id === booking.id)) {
            set({ inviteQueue: [...queue, booking] });
          }
        }
        // If the status left 'pending' (someone acted, or creator canceled),
        // drop it from the toast queue so we don't show a stale invite.
        if (booking.status !== 'pending') {
          set({ inviteQueue: get().inviteQueue.filter((b) => b.id !== booking.id) });
        }

        // When a booking just gained a projectId (i.e. the invitee accepted
        // and the server auto-provisioned a shared project), refresh the
        // project list directly so both users' sidebars show it immediately,
        // even if they're not currently inside a project.
        if (booking.projectId && prev?.projectId !== booking.projectId) {
          useProjectStore.getState().fetchProjects();
        }
      });
      socketHandlerAttached = true;
    }
  },

  create: async (input) => {
    const created = await api.createBooking(input);
    set({ bookings: [created, ...get().bookings] });
    return created;
  },

  accept: async (id) => {
    const prev = get().bookings.find((b) => b.id === id);
    const updated = await api.updateBooking(id, { status: 'accepted' });
    set({
      bookings: get().bookings.map((b) => b.id === id ? updated : b),
      inviteQueue: get().inviteQueue.filter((b) => b.id !== id),
    });
    if (updated.projectId && prev?.projectId !== updated.projectId) {
      await useProjectStore.getState().fetchProjects();
    }
  },

  decline: async (id) => {
    const updated = await api.updateBooking(id, { status: 'declined' });
    set({
      bookings: get().bookings.map((b) => b.id === id ? updated : b),
      inviteQueue: get().inviteQueue.filter((b) => b.id !== id),
    });
  },

  cancel: async (id) => {
    const prev = get().bookings.find((b) => b.id === id);
    const updated = await api.updateBooking(id, { status: 'canceled' });
    set({ bookings: get().bookings.map((b) => b.id === id ? updated : b) });
    // Refresh the projects list so the host's sidebar drops the auto-created
    // shared project the server just tore down.
    if (prev?.projectId) {
      await useProjectStore.getState().fetchProjects();
    }
  },

  remove: async (id) => {
    const prev = get().bookings.find((b) => b.id === id);
    await api.deleteBooking(id);
    set({
      bookings: get().bookings.filter((b) => b.id !== id),
      inviteQueue: get().inviteQueue.filter((b) => b.id !== id),
    });
    if (prev?.projectId) {
      await useProjectStore.getState().fetchProjects();
    }
  },

  dismissInvite: (id) => {
    set({ inviteQueue: get().inviteQueue.filter((b) => b.id !== id) });
  },
}));
