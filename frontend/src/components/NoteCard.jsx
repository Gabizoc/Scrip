import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, FolderOpen, MoreHorizontal } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import SubjectEditor from './SubjectEditor.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import MoveNoteSheet from './MoveNoteSheet.jsx';
import { api } from '../lib/api.js';
import { parseScore, scoreColor, subjectColor, subjectColorStyle } from '../lib/noteUtils.js';
import { useSubjectByName } from '../lib/SubjectsContext.jsx';

export default function NoteCard({ note, index = 0 }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editorRect, setEditorRect]           = useState(null);
  const [showMove, setShowMove] = useState(false);
  const delay = Math.min(index, 9);

  const subjectData = useSubjectByName(note.subject);
  const customStyle = subjectColorStyle(subjectData?.color ?? null);
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
        'card-hover',
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
              !customStyle && note.subject ? subjectColor(note.subject) : '',
              !customStyle && !note.subject ? 'bg-black/[0.05] dark:bg-white/[0.07] text-text-tertiary' : '',
            ].join(' ')}
            style={customStyle ?? undefined}
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

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            className="shrink-0 p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10"
            onClick={e => { e.stopPropagation(); setShowMove(true); }}
            title="Déplacer"
            aria-label="Déplacer la note"
          >
            <MoreHorizontal size={13} />
          </button>
          <button
            className="shrink-0 p-1.5 rounded-md text-text-tertiary hover:text-status-danger hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleDelete}
            title="Supprimer"
            aria-label="Supprimer la note"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Titre + résumé */}
      <div className="flex-1 min-h-0 flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold text-text-primary line-clamp-2 leading-snug">
          {note.title}
        </h3>
        {note.metadata?.resume && (
          <p className="text-[11px] text-text-secondary italic line-clamp-2 leading-snug opacity-80">
            {note.metadata.resume}
          </p>
        )}
      </div>

      {/* Sous-dossier */}
      {note.subfolder && (
        <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
          <FolderOpen size={10} className="shrink-0 opacity-60" />
          <span className="truncate">{note.subfolder}</span>
        </div>
      )}

      {/* Ligne du bas : date + score */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{date}</span>
        {score != null && (
          <span className={`text-xs font-semibold font-mono ${scoreColor(score)}`}>
            {score}/100
          </span>
        )}
      </div>

      {/* Sheet de déplacement */}
      {showMove && (
        <MoveNoteSheet note={note} onClose={() => setShowMove(false)} />
      )}

      {/* Modal de confirmation suppression */}
      {showDeleteModal && (
        <ConfirmModal
          title="Supprimer ce cours ?"
          message={`« ${note.title} » sera déplacé vers la corbeille. Vous pourrez le restaurer depuis Paramètres › Corbeille.`}
          confirmLabel="Supprimer"
          onConfirm={() => { setShowDeleteModal(false); deleteMutation.mutate(); }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </GlassCard>
  );
}
