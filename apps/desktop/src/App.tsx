import { useAuthStore } from './stores/authStore';
import PluginLayout from './components/plugin/PluginLayout';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <ErrorBoundary>
      {isAuthenticated ? <PluginLayout /> : <LoginPage />}
    </ErrorBoundary>
  );
}
