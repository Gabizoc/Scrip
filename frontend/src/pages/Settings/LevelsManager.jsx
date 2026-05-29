import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';

export default function LevelsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: levels = [] } = useQuery({ queryKey: ['levels'], queryFn: api.getLevels });

  const create = useMutation({
    mutationFn: () => api.createLevel(newName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['levels'] }); setNewName(''); },
  });

  const del = useMutation({
    mutationFn: api.deleteLevel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['levels'] }),
    onError: (e) => alert(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <button onClick={() => navigate('/settings')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Paramètres
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Niveaux</h1>

      <div className="space-y-3">
        {levels.map(level => (
          <GlassCard key={level.id} className="px-4 py-3 flex items-center justify-between">
            <span className="text-[15px] text-text-primary">{level.name}</span>
            <button onClick={() => del.mutate(level.id)} className="text-status-danger p-1 hover:opacity-70 transition-opacity" aria-label={`Supprimer ${level.name}`}>
              <Trash2 size={16} />
            </button>
          </GlassCard>
        ))}

        {levels.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-6">Aucun niveau · ajoutez-en un ci-dessous.</p>
        )}

        <GlassCard className="p-4 space-y-3">
          <Input label="Nouveau niveau" value={newName} onChange={setNewName} placeholder="ex : 1ère, Terminale..." />
          <Button className="w-full" onClick={() => create.mutate()} disabled={!newName.trim() || create.isPending}>
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
