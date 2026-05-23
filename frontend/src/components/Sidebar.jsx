// frontend/src/components/Sidebar.jsx
import { NavLink, useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith('/preview');

  return (
    <aside className="sidebar-glass hidden md:flex flex-col fixed left-0 top-0 h-screen w-56 z-20">

      {/* Logo */}
      <div className="px-6 h-16 flex items-center shrink-0
        border-b border-black/[0.06] dark:border-white/[0.06]">
        <span className="font-display text-[22px] font-bold tracking-tight text-text-primary">
          Scrip
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, end }, i) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => [
              'group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium',
              'transition-all duration-200 animate-slide-in-left',
              (isActive || (to === '/' && isPreview))
                ? 'bg-accent/[0.12] text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
            ].join(' ')}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme switcher */}
      <div className="p-4 shrink-0 border-t border-black/[0.06] dark:border-white/[0.06]">
        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-2.5 px-1">
          Thème
        </p>
        <div className="flex rounded-md overflow-hidden
          border border-black/[0.07] dark:border-white/[0.08]
          bg-black/[0.03] dark:bg-white/[0.03]">
          {THEMES.map(({ val, Icon, label }) => (
            <button
              key={val}
              onClick={() => setTheme(val)}
              title={label}
              className={[
                'flex-1 flex items-center justify-center py-2 transition-all duration-200',
                theme === val
                  ? 'bg-accent text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
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
