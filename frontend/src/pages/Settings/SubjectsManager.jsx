import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Dropdown from '../../components/Dropdown.jsx';
import EmojiButton from '../../components/subjects/EmojiButton.jsx';
import ColorPickerField from '../../components/subjects/ColorPickerField.jsx';
import SubjectCard from '../../components/subjects/SubjectCard.jsx';

const EMPTY_FORM = { name: '', levelId: '', prompt: 'default', outputFolder: '', emoji: '', color: '' };

export default function SubjectsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterLevelId, setFilterLevelId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: levels = [] }  = useQuery({ queryKey: ['levels'],  queryFn: api.getLevels });
  const { data: prompts = [] } = useQuery({ queryKey: ['prompts'], queryFn: api.getPrompts });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', filterLevelId],
    queryFn: () => api.getSubjects(filterLevelId || undefined),
  });

  const create = useMutation({
    mutationFn: () => api.createSubject(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); setForm(EMPTY_FORM); },
    onError: e => alert(e.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, data }) => api.patchSubject(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const del = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
    onError: e => alert(e.message),
  });

  const field = k => v => setForm(f => ({ ...f, [k]: v }));
  const dropdownClass = 'h-12 px-4 rounded-md text-[15px] bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.06] text-text-primary';

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Paramètres
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Matières</h1>

      <div className="space-y-3">
        <Dropdown
          value={filterLevelId}
          onChange={setFilterLevelId}
          options={[{ value: '', label: 'Tous les niveaux' }, ...levels.map(l => ({ value: l.id, label: l.name }))]}
          fullWidth
          className={dropdownClass.replace('h-12', 'h-10')}
        />

        {subjects.map(s => (
          <SubjectCard
            key={s.id}
            subject={s}
            levels={levels}
            prompts={prompts}
            onPatch={(id, data) => patch.mutate({ id, data })}
            onDelete={id => del.mutate(id)}
          />
        ))}

        {subjects.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-6">
            Aucune matière{filterLevelId ? ' pour ce niveau' : ''}.
          </p>
        )}

        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Nouvelle matière</h3>

          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Icône</label>
              <EmojiButton
                value={form.emoji}
                name={form.name}
                onChange={v => setForm(f => ({ ...f, emoji: v }))}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Nom</label>
              <input
                type="text"
                value={form.name}
                onChange={e => field('name')(e.target.value)}
                placeholder="ex : Histoire"
                className="h-12 px-4 rounded-md text-[15px]
                  bg-black/[0.03] dark:bg-white/[0.04]
                  border border-black/[0.08] dark:border-white/[0.06]
                  text-text-primary placeholder:text-text-tertiary
                  focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Niveau</label>
            <Dropdown
              value={form.levelId}
              onChange={field('levelId')}
              options={levels.map(l => ({ value: l.id, label: l.name }))}
              placeholder="Choisir un niveau"
              fullWidth
              className={dropdownClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Prompt IA</label>
            <Dropdown
              value={form.prompt}
              onChange={field('prompt')}
              options={prompts.map(p => ({ value: p.key, label: p.name }))}
              fullWidth
              className={dropdownClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Dossier de sortie</label>
            <input
              type="text"
              value={form.outputFolder}
              onChange={e => field('outputFolder')(e.target.value)}
              placeholder="ex : Histoire"
              className="h-12 px-4 rounded-md text-[15px]
                bg-black/[0.03] dark:bg-white/[0.04]
                border border-black/[0.08] dark:border-white/[0.06]
                text-text-primary placeholder:text-text-tertiary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Couleur</label>
            <ColorPickerField value={form.color} onChange={v => setForm(f => ({ ...f, color: v }))} />
          </div>

          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={!form.name || !form.levelId || !form.outputFolder || create.isPending}
          >
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
