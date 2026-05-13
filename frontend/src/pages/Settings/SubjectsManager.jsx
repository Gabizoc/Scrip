// frontend/src/pages/Settings/SubjectsManager.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';

const PROMPT_OPTIONS = ['shs', 'emc'];
const EMPTY_FORM = { name: '', levelId: '', prompt: 'shs', outputFolder: '' };

export default function SubjectsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterLevelId, setFilterLevelId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: levels = [] } = useQuery({ queryKey: ['levels'], queryFn: api.getLevels });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', filterLevelId],
    queryFn: () => api.getSubjects(filterLevelId || undefined),
  });

  const create = useMutation({
    mutationFn: () => api.createSubject(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); setForm(EMPTY_FORM); },
    onError: (e) => alert(e.message),
  });

  const del = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
    onError: (e) => alert(e.message),
  });

  const field = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const selectClass = [
    'w-full h-12 px-4 rounded-md text-[15px]',
    'bg-black/[0.03] dark:bg-white/[0.04]',
    'border border-black/[0.08] dark:border-white/[0.06]',
    'text-text-primary focus:outline-none focus:border-accent/50',
  ].join(' ');

  return (
    <div className="p-6 md:p-8 max-w-lg">
      <button onClick={() => navigate('/settings')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Paramètres
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Matières</h1>

      <div className="space-y-3">
        {/* Filtre */}
        <select value={filterLevelId} onChange={e => setFilterLevelId(e.target.value)} className={selectClass.replace('h-12', 'h-10')}>
          <option value="">Tous les niveaux</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        {/* Liste */}
        {subjects.map(s => {
          const level = levels.find(l => l.id === s.levelId);
          return (
            <GlassCard key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-text-primary truncate">{s.name}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{level?.name ?? '—'} · {s.prompt} · {s.outputFolder}</p>
              </div>
              <button onClick={() => del.mutate(s.id)} className="text-status-danger p-1 shrink-0 hover:opacity-70 transition-opacity">
                <Trash2 size={16} />
              </button>
            </GlassCard>
          );
        })}

        {subjects.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-6">Aucune matière{filterLevelId ? ' pour ce niveau' : ''}.</p>
        )}

        {/* Formulaire */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Nouvelle matière</h3>
          <Input label="Nom" value={form.name} onChange={field('name')} placeholder="ex : Histoire" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Niveau</label>
            <select value={form.levelId} onChange={e => field('levelId')(e.target.value)} className={selectClass}>
              <option value="">Choisir un niveau</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Prompt IA</label>
            <select value={form.prompt} onChange={e => field('prompt')(e.target.value)} className={selectClass}>
              {PROMPT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Input label="Dossier de sortie" value={form.outputFolder} onChange={field('outputFolder')} placeholder="ex : Histoire" />
          <Button className="w-full" onClick={() => create.mutate()} disabled={!form.name || !form.levelId || !form.outputFolder || create.isPending}>
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
