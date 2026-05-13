// frontend/src/pages/Settings/SubjectsManager.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';

const PROMPT_OPTIONS = ['shs', 'svt', 'emc'];

const EMPTY_FORM = { name: '', levelId: '', prompt: 'shs', outputFolder: '' };

export default function SubjectsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterLevelId, setFilterLevelId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: api.getLevels,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', filterLevelId],
    queryFn: () => api.getSubjects(filterLevelId || undefined),
  });

  const create = useMutation({
    mutationFn: () => api.createSubject(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setForm(EMPTY_FORM);
    },
    onError: (e) => alert(e.message),
  });

  const del = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
    onError: (e) => alert(e.message),
  });

  const field = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const selectClass = [
    'w-full h-12 px-4 rounded-md',
    'bg-black/[0.03] dark:bg-white/[0.04]',
    'border border-black/[0.08] dark:border-white/[0.06]',
    'text-text-primary text-[15px]',
    'focus:outline-none',
  ].join(' ');

  return (
    <div className="min-h-screen p-4">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Paramètres</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">Matières</h2>

      <div className="space-y-3 max-w-lg">
        {/* Filtre par niveau */}
        <select
          value={filterLevelId}
          onChange={e => setFilterLevelId(e.target.value)}
          className={selectClass.replace('h-12', 'h-10').replace('text-[15px]', 'text-sm text-text-secondary')}
        >
          <option value="">Tous les niveaux</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        {/* Liste matières */}
        {subjects.map(s => {
          const level = levels.find(l => l.id === s.levelId);
          return (
            <GlassCard key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-text-primary truncate">
                  {s.name}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {level?.name ?? '—'} · prompt : {s.prompt} · {s.outputFolder}
                </p>
              </div>
              <button
                onClick={() => del.mutate(s.id)}
                className="text-status-danger p-1 shrink-0"
                aria-label={`Supprimer ${s.name}`}
              >
                <Trash2 size={16} />
              </button>
            </GlassCard>
          );
        })}

        {subjects.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">
            Aucune matière{filterLevelId ? ' pour ce niveau' : ''}.
          </p>
        )}

        {/* Formulaire création */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">
            Nouvelle matière
          </h3>

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

          <Input
            label="Dossier de sortie"
            value={form.outputFolder}
            onChange={field('outputFolder')}
            placeholder="ex : Histoire (nom du dossier dans le vault)"
          />

          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={
              !form.name || !form.levelId || !form.outputFolder || create.isPending
            }
          >
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
