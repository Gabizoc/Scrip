import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Edit2, Trash2, Check, X } from 'lucide-react';
import { api } from '../lib/api.js';
import GlassCard from '../components/GlassCard.jsx';
import Button from '../components/Button.jsx';

export default function Preview() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.getNote(noteId),
  });

  // Initialiser le draft quand les données arrivent
  useEffect(() => {
    if (data?.markdown) setDraft(data.markdown);
  }, [data?.markdown]);

  const patchNote = useMutation({
    mutationFn: (md) => api.patchNote(noteId, md),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['note', noteId] });
      qc.invalidateQueries({ queryKey: ['notes'] });
      setEditing(false);
    },
  });

  const deleteNote = useMutation({
    mutationFn: () => api.deleteNote(noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      navigate('/');
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 text-text-tertiary text-sm">Chargement...</div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-status-danger text-sm">{error.message}</div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header sticky */}
      <header className={[
        'sticky top-0 z-10',
        'px-4 py-3',
        'backdrop-blur-glass bg-bg-base/80',
        'border-b border-black/[0.06] dark:border-white/[0.06]',
      ].join(' ')}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="text-text-secondary p-1 -ml-1"
            aria-label="Retour"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="text-text-secondary p-2"
                  aria-label="Annuler"
                >
                  <X size={18} />
                </button>
                <Button
                  onClick={() => patchNote.mutate(draft)}
                  disabled={patchNote.isPending}
                  className="h-9 text-sm px-4"
                >
                  <Check size={14} className="inline mr-1" />
                  Sauvegarder
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-text-secondary p-2"
                  aria-label="Éditer"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Supprimer ce cours ?')) deleteNote.mutate();
                  }}
                  className="text-status-danger p-2"
                  aria-label="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 max-w-2xl mx-auto">
        {editing ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className={[
              'w-full h-[75vh] p-4 rounded-md',
              'bg-black/[0.03] dark:bg-white/[0.04]',
              'border border-black/[0.08] dark:border-white/[0.06]',
              'text-text-primary font-mono text-sm',
              'resize-none focus:outline-none',
              'focus:border-accent/40',
            ].join(' ')}
          />
        ) : (
          <GlassCard className="p-6">
            {/* prose : typo Tailwind pour le rendu markdown */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{data?.markdown ?? ''}</ReactMarkdown>
            </div>
          </GlassCard>
        )}
      </main>
    </div>
  );
}
