// frontend/src/pages/Settings/index.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';

const NAV_ITEMS = [
  { label: 'Gérer les niveaux',  path: '/settings/levels' },
  { label: 'Gérer les matières', path: '/settings/subjects' },
];

export default function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: levels = [] } = useQuery({ queryKey: ['levels'], queryFn: api.getLevels });

  const updateSettings = useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const selectClass = [
    'w-full h-12 px-4 rounded-md text-[15px]',
    'bg-black/[0.03] dark:bg-white/[0.04]',
    'border border-black/[0.08] dark:border-white/[0.06]',
    'text-text-primary focus:outline-none focus:border-accent/50',
  ].join(' ');

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Paramètres</h1>
      </div>

      <div className="space-y-4">
        {/* Thème — mobile only (desktop has sidebar toggle) */}
        <div className="md:hidden">
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Thème</h3>
            <ThemeToggle />
          </GlassCard>
        </div>

        {/* Niveau courant */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Niveau actuel</h3>
          <select
            value={settings?.currentLevelId ?? ''}
            onChange={e => updateSettings.mutate({ currentLevelId: e.target.value })}
            className={selectClass}
          >
            <option value="">Choisir un niveau...</option>
            {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </GlassCard>

        {/* Navigation */}
        {NAV_ITEMS.map(({ label, path }) => (
          <GlassCard key={path} className="p-4 cursor-pointer" onClick={() => navigate(path)}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-text-primary">{label}</span>
              <ChevronRight size={18} className="text-text-tertiary" />
            </div>
          </GlassCard>
        ))}

        {/* Vault path */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Vault path</h3>
          <input
            key={settings?.vaultPath}
            defaultValue={settings?.vaultPath ?? ''}
            onBlur={e => updateSettings.mutate({ vaultPath: e.target.value })}
            className={selectClass + ' font-mono text-sm'}
            placeholder="/home/scrip/vault"
          />
        </GlassCard>
      </div>
    </div>
  );
}
