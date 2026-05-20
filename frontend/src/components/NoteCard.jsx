// frontend/src/components/NoteCard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import SubjectEditor from './SubjectEditor.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { api } from '../lib/api.js';
import { parseScore, scoreColor, subjectColor } from '../lib/noteUtils.js';

export default function NoteCard({ note, index = 0 }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editorRect, setEditorRect]           = useState(null);
  const delay = Math.min(index, 9);

  const score = parseScore(note.metadata?.qualite_francais);
  const date = new Date(note.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteNote(note.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  return (
    <GlassCard
      className={[
        'group p-5 cursor-pointer animate-fade-in-up flex flex-col gap-3',
        `stagger-${delay + 1}`,
        'hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(110,108,232,0.18)]',
        'transition-all duration-300 ease-out',
        'active:scale-[0.97] active:translate-y-0',
      ].join(' ')}
      onClick={() => navigate(`/preview/${note.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/preview/${note.id}`);
      }}
      aria-label={`Ouvrir le cours : ${note.title}`}
    >
      {/* Ligne du haut : matière + bouton suppression */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={e => { e.stopPropagation(); setEditorRect(e.currentTarget.getBoundingClientRect()); }}
            title="Modifier la matière"
            className={[
              'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full transition',
              'hover:ring-2 hover:ring-accent/40 hover:ring-offset-1',
              note.subject ? subjectColor(note.subject) : 'bg-black/[0.05] dark:bg-white/[0.07] text-text-tertiary',
            ].join(' ')}
          >
            {note.subject ?? '+ matière'}
          </button>
          {editorRect && (
            <SubjectEditor
              note={note}
              triggerRect={editorRect}
              onClose={() => setEditorRect(null)}
            />
          )}
          {note.level && (
            <span className="text-[11px] text-text-tertiary truncate">{note.level}</span>
          )}
        </div>

        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150
            p-1.5 rounded-md text-text-tertiary hover:text-status-danger hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={handleDelete}
          title="Supprimer"
          aria-label="Supprimer la note"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Titre */}
      <h3 className="text-[14px] font-semibold text-text-primary line-clamp-2 leading-snug flex-1">
        {note.title}
      </h3>

      {/* Ligne du bas : date + score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{date}</span>
        {score != null && (
          <span className={`text-xs font-semibold font-mono ${scoreColor(score)}`}>
            {score}/100
          </span>
        )}
      </div>

      {/* Modal de confirmation suppression */}
      {showDeleteModal && (
        <ConfirmModal
          title="Supprimer ce cours ?"
          message={`« ${note.title} » sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          onConfirm={() => { setShowDeleteModal(false); deleteMutation.mutate(); }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </GlassCard>
  );
}
