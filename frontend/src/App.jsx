// frontend/src/App.jsx
import { useQuery }      from '@tanstack/react-query';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SubjectsProvider } from './lib/SubjectsContext.jsx';
import { authApi }       from './lib/auth.js';
import Sidebar           from './components/Sidebar.jsx';
import BottomNav         from './components/BottomNav.jsx';
import Home              from './pages/Home.jsx';
import Capture           from './pages/Capture.jsx';
import Preview           from './pages/Preview.jsx';
import Settings          from './pages/Settings/index.jsx';
import LevelsManager     from './pages/Settings/LevelsManager.jsx';
import SubjectsManager   from './pages/Settings/SubjectsManager.jsx';
import Login             from './pages/Login.jsx';
import Setup             from './pages/Setup.jsx';
import SetupPassword     from './pages/SetupPassword.jsx';
import ResetPassword     from './pages/ResetPassword.jsx';

function Background() {
  return <div className="fixed inset-0 -z-10 pointer-events-none bg-bg-base" aria-hidden="true" />;
}

function PageWrapper({ children }) {
  const location = useLocation();
  return <div key={location.pathname} className="page-enter">{children}</div>;
}

function ProtectedLayout() {
  return (
    <SubjectsProvider>
      <div className="min-h-screen bg-bg-base text-text-primary">
        <Background />
        <Sidebar />
        <BottomNav />
        <div className="md:pl-56 min-h-screen pb-16 md:pb-0">
          <PageWrapper>
            <Routes>
              <Route path="/"                  element={<Home />} />
              <Route path="/capture"           element={<Capture />} />
              <Route path="/preview/:noteId"   element={<Preview />} />
              <Route path="/settings"          element={<Settings />} />
              <Route path="/settings/levels"   element={<LevelsManager />} />
              <Route path="/settings/subjects" element={<SubjectsManager />} />
            </Routes>
          </PageWrapper>
        </div>
      </div>
    </SubjectsProvider>
  );
}

/**
 * Guard global — un seul appel /api/auth/status pour toute l'app.
 *
 * needsSetup → /setup (toutes les autres routes redirigent ici)
 * loggedIn   → app protégée
 * sinon      → /login ou /reset/:token
 */
function AppGuard() {
  const { data, isLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn:  authApi.status,
    retry:    false,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="min-h-screen bg-bg-base" />;

  // Pas encore de mot de passe défini → setup obligatoire
  if (data?.needsSetup) {
    return (
      <Routes>
        <Route path="/setup/password" element={<SetupPassword />} />
        <Route path="*"               element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // Connecté → app complète
  if (data?.loggedIn) {
    return (
      <Routes>
        <Route path="/login"          element={<Navigate to="/" replace />} />
        <Route path="/setup"          element={<Navigate to="/" replace />} />
        <Route path="/setup/password" element={<Navigate to="/" replace />} />
        <Route path="*"               element={<ProtectedLayout />} />
      </Routes>
    );
  }

  // Non connecté → login ou reset uniquement
  return (
    <Routes>
      <Route path="/login"          element={<Login />} />
      <Route path="/reset/:token"   element={<ResetPassword />} />
      <Route path="*"               element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      {/* /setup est toujours accessible (avant le check — évite une boucle) */}
      <Route path="/setup" element={<Setup />} />
      <Route path="*"      element={<AppGuard />} />
    </Routes>
  );
}
