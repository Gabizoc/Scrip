// frontend/src/App.jsx
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import Capture from './pages/Capture.jsx';
import Preview from './pages/Preview.jsx';
import Settings from './pages/Settings/index.jsx';
import LevelsManager from './pages/Settings/LevelsManager.jsx';
import SubjectsManager from './pages/Settings/SubjectsManager.jsx';

function BackgroundDots() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(98,86,220,0.1) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }}
    />
  );
}

function PageWrapper({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <BackgroundDots />
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
  );
}
