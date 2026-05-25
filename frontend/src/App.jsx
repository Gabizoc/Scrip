// frontend/src/App.jsx
import { Routes, Route, useLocation } from 'react-router-dom';
import { SubjectsProvider } from './lib/SubjectsContext.jsx';
import Sidebar        from './components/Sidebar.jsx';
import BottomNav      from './components/BottomNav.jsx';
import AuthGuard      from './components/AuthGuard.jsx';
import Home           from './pages/Home.jsx';
import Capture        from './pages/Capture.jsx';
import Preview        from './pages/Preview.jsx';
import Settings       from './pages/Settings/index.jsx';
import LevelsManager  from './pages/Settings/LevelsManager.jsx';
import SubjectsManager from './pages/Settings/SubjectsManager.jsx';
import Login          from './pages/Login.jsx';
import Setup          from './pages/Setup.jsx';
import SetupPassword  from './pages/SetupPassword.jsx';
import ResetPassword  from './pages/ResetPassword.jsx';

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
              <Route path="/"                   element={<Home />} />
              <Route path="/capture"            element={<Capture />} />
              <Route path="/preview/:noteId"    element={<Preview />} />
              <Route path="/settings"           element={<Settings />} />
              <Route path="/settings/levels"    element={<LevelsManager />} />
              <Route path="/settings/subjects"  element={<SubjectsManager />} />
            </Routes>
          </PageWrapper>
        </div>
      </div>
    </SubjectsProvider>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Routes publiques — pas d'AuthGuard */}
      <Route path="/login"           element={<Login />} />
      <Route path="/setup"           element={<Setup />} />
      <Route path="/setup/password"  element={<SetupPassword />} />
      <Route path="/reset/:token"    element={<ResetPassword />} />

      {/* Toutes les autres routes sont protégées */}
      <Route path="*" element={
        <AuthGuard>
          <ProtectedLayout />
        </AuthGuard>
      } />
    </Routes>
  );
}
