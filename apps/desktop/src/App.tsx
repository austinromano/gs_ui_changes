import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useBookingsStore } from './stores/bookingsStore';
import PluginLayout from './components/plugin/PluginLayout';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineScreen from './components/onboarding/OfflineScreen';
import BookingInviteToast from './components/messages/BookingInviteToast';
import PublicProjectViewer from './components/public/PublicProjectViewer';
import { useOnlineStatus } from './hooks/useOnlineStatus';

// Public share URLs are `/p/<token>` and bypass auth entirely. Detect the
// path once on module load — the viewer renders independently of the
// editor's auth state, bookings bootstrap, and offline screen.
function getShareTokenFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/p\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const shareToken = getShareTokenFromPath();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const bootstrapBookings = useBookingsStore((s) => s.bootstrap);
  const online = useOnlineStatus();

  // Bootstrap bookings at the app level (not inside the Messages page) so
  // the socket handler is attached regardless of which section the user is
  // viewing. Incoming invites need to trigger the global toast.
  useEffect(() => {
    if (shareToken) return;
    if (!isAuthenticated || !currentUserId) return;
    bootstrapBookings();
  }, [shareToken, isAuthenticated, currentUserId, bootstrapBookings]);

  if (shareToken) {
    return (
      <ErrorBoundary>
        <PublicProjectViewer token={shareToken} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {isAuthenticated ? <PluginLayout /> : <LoginPage />}
      {isAuthenticated && <BookingInviteToast />}
      <AnimatePresence>{!online && <OfflineScreen key="offline" />}</AnimatePresence>
    </ErrorBoundary>
  );
}
