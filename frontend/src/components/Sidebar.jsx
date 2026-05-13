// frontend/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { BookOpen, Camera, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

const NAV = [
  { to: '/',         icon: BookOpen, label: 'Cours',       end: true },
  { to: '/capture',  icon: Camera,   label: 'Capturer',    end: false },
  { to: '/settings', icon: Settings, label: 'Paramètres',  end: false },
];

const THEMES = [
  { val: 'light', Icon: Sun,     label: 'Clair' },
  { val: 'auto',  Icon: Monitor, label: 'Auto'  },
  { val: 'dark',  Icon: Moon,    label: 'Sombre'},
];

export default function Sidebar() {
  const { theme, setTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-56 z-20
      bg-bg-elevated border-r border-black/[0.06] dark:border-white/[0.06]">

      {/* Logo */}
      <div className="px-6 h-16 flex items-center border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
        <span className="text-xl font-bold tracking-tight text-text-primary">Scrip</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => [
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
            ].join(' ')}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme switcher */}
      <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0">
        <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1">Thème</p>
        <div className="flex rounded-md overflow-hidden border border-black/[0.08] dark:border-white/10">
          {THEMES.map(({ val, Icon, label }) => (
            <button
              key={val}
              onClick={() => setTheme(val)}
              title={label}
              className={[
                'flex-1 flex items-center justify-center py-2 text-[11px] gap-1 transition-colors',
                theme === val
                  ? 'bg-accent text-white font-semibold'
                  : 'text-text-tertiary hover:text-text-primary',
              ].join(' ')}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
