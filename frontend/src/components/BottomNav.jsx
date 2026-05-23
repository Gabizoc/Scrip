// frontend/src/components/BottomNav.jsx
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Camera, Settings } from 'lucide-react';

const NAV = [
  { to: '/',         icon: BookOpen, label: 'Cours',      end: true  },
  { to: '/capture',  icon: Camera,   label: 'Capturer',   end: false },
  { to: '/settings', icon: Settings, label: 'Paramètres', end: false },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith('/preview');

  return (
    <nav className="bottom-nav-glass md:hidden fixed bottom-0 left-0 right-0 z-20 flex">
      {NAV.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => [
            'flex-1 flex flex-col items-center gap-1 py-3',
            'text-[10px] font-medium transition-all duration-200',
            (isActive || (to === '/' && isPreview)) ? 'text-accent scale-105' : 'text-text-tertiary hover:text-text-secondary',
          ].join(' ')}
        >
          {({ isActive }) => (
            <>
              <Icon size={22} className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
