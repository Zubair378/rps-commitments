import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import type { User } from './types.js';
import { Layout } from './components/Layout.js';
import { Loading } from './ui.js';
import { HomePage } from './pages/HomePage.js';
import { AuthPage } from './pages/AuthPage.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { TournamentPage } from './pages/TournamentPage.js';
import { MatchPage } from './pages/MatchPage.js';
import { KeysPage } from './pages/KeysPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { ComingSoonPage } from './pages/ComingSoonPage.js';

type AuthState = {
  user: User | null;
  loading: boolean;
  setUser(user: User | null): void;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth provider missing');
  return value;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api<User>('/api/me')
      .then((result) => {
        if (active) setUser(result);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function logout() {
    await api('/api/logout', { method: 'POST' });
    setUser(null);
    navigate('/');
  }
  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Checking your session…" />;
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/lobby"
            element={
              <RequireAuth>
                <LobbyPage />
              </RequireAuth>
            }
          />
          <Route path="/tournaments/:id" element={<TournamentPage />} />
          <Route path="/matches/:id" element={<MatchPage />} />
          <Route
            path="/keys"
            element={
              <RequireAuth>
                <KeysPage />
              </RequireAuth>
            }
          />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/attack-lab" element={<ComingSoonPage kind="attacks" />} />
          <Route path="/benchmarks" element={<ComingSoonPage kind="benchmarks" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
