// frontend/src/components/ThemeToggle.jsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

const OPTIONS = [
  { value: 'dark',  Icon: Moon,    label: 'Sombre' },
  { value: 'light', Icon: Sun,     label: 'Clair'  },
  { value: 'auto',  Icon: Monitor, label: 'Auto'   },
];

/**
 * Segmented control 3 options : Sombre / Clair / Auto.
 * Option active = fond accent.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-md overflow-hidden border border-black/[0.08] dark:border-white/10">
      {OPTIONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={[
            'flex-1 flex items-center justify-center gap-1.5',
            'h-10 px-3 text-sm transition-colors duration-150',
            theme === value
              ? 'bg-accent text-white dark:text-bg-base font-semibold'
              : 'text-text-secondary hover:text-text-primary',
          ].join(' ')}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
