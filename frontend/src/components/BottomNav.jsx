// frontend/src/components/BottomNav.jsx
import { NavLink } from 'react-router-dom';
import { BookOpen, Camera, Settings } from 'lucide-react';

const NAV = [
  { to: '/',         icon: BookOpen, label: 'Cours',      end: true  },
  { to: '/capture',  icon: Camera,   label: 'Capturer',   end: false },
  { to: '/settings', icon: Settings, label: 'Paramètres', end: false },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex
      bg-bg-elevated/90 backdrop-blur-glass
      border-t border-black/[0.06] dark:border-white/[0.06]
      safe-area-inset-bottom">
      {NAV.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => [
            'flex-1 flex flex-col items-center gap-1 py-3',
            'text-[10px] font-medium transition-colors',
            isActive ? 'text-accent' : 'text-text-tertiary',
          ].join(' ')}
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
