// frontend/src/App.jsx
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Capture from './pages/Capture.jsx';
import Preview from './pages/Preview.jsx';
import Settings from './pages/Settings/index.jsx';
import LevelsManager from './pages/Settings/LevelsManager.jsx';
import SubjectsManager from './pages/Settings/SubjectsManager.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Routes>
        <Route path="/"                   element={<Home />} />
        <Route path="/capture"            element={<Capture />} />
        <Route path="/preview/:noteId"    element={<Preview />} />
        <Route path="/settings"           element={<Settings />} />
        <Route path="/settings/levels"    element={<LevelsManager />} />
        <Route path="/settings/subjects"  element={<SubjectsManager />} />
      </Routes>
    </div>
  );
}
