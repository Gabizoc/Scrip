// frontend/src/pages/Settings/LevelsManager.jsx
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

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: api.getLevels,
  });

  const create = useMutation({
    mutationFn: () => api.createLevel(newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['levels'] });
      setNewName('');
    },
  });

  const del = useMutation({
    mutationFn: api.deleteLevel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['levels'] }),
    onError: (e) => alert(e.message),
  });

  return (
    <div className="min-h-screen p-4">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Paramètres</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">Niveaux</h2>

      <div className="space-y-3 max-w-lg">
        {levels.map(level => (
          <GlassCard
            key={level.id}
            className="p-4 flex items-center justify-between"
          >
            <span className="text-[15px] text-text-primary">{level.name}</span>
            <button
              onClick={() => del.mutate(level.id)}
              className="text-status-danger p-1"
              aria-label={`Supprimer ${level.name}`}
            >
              <Trash2 size={16} />
            </button>
          </GlassCard>
        ))}

        {levels.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">
            Aucun niveau — ajoutez-en un ci-dessous.
          </p>
        )}

        {/* Formulaire ajout */}
        <GlassCard className="p-4 space-y-3">
          <Input
            label="Nouveau niveau"
            value={newName}
            onChange={setNewName}
            placeholder="ex : 1ère, Terminale, Terminale spé NSI"
          />
          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={!newName.trim() || create.isPending}
          >
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
