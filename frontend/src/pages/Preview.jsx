// frontend/src/pages/Preview.jsx
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

  if (isLoading) return <div className="p-8 text-text-tertiary text-sm">Chargement...</div>;
  if (error) return <div className="p-8 text-status-danger text-sm">{error.message}</div>;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Cours
        </button>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md border border-black/[0.08] dark:border-white/10 transition-colors"
              >
                <X size={14} /> Annuler
              </button>
              <Button
                onClick={() => patchNote.mutate(draft)}
                disabled={patchNote.isPending}
                className="h-9 text-sm px-4"
              >
                <Check size={14} className="inline mr-1" /> Sauvegarder
              </Button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-md border border-black/[0.08] dark:border-white/10 transition-colors"
              >
                <Edit2 size={14} /> Éditer
              </button>
              <button
                onClick={() => confirm('Supprimer ce cours ?') && deleteNote.mutate()}
                className="flex items-center gap-1.5 text-sm text-status-danger hover:text-status-danger/80 px-3 py-1.5 rounded-md border border-status-danger/20 transition-colors"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className={[
            'w-full h-[70vh] p-5 rounded-lg',
            'bg-bg-elevated dark:bg-bg-elevated',
            'border border-black/[0.08] dark:border-white/[0.06]',
            'text-text-primary font-mono text-sm leading-relaxed',
            'resize-none focus:outline-none focus:border-accent/50',
            'transition-colors',
          ].join(' ')}
        />
      ) : (
        <GlassCard className="p-6 md:p-8">
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-text-primary prose-p:text-text-primary
            prose-strong:text-text-primary prose-code:text-accent">
            <ReactMarkdown>{data?.markdown ?? ''}</ReactMarkdown>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
