// frontend/src/components/MoveNoteSheet.jsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, FolderInput } from 'lucide-react';
import { api } from '../lib/api.js';

/**
 * Feuille inférieure pour déplacer une note vers une autre matière / sous-dossier.
 *
 * Props:
 *   note     — objet note (id, subjectId, subfolder)
 *   onClose  — callback de fermeture
 */
export default function MoveNoteSheet({ note, onClose }) {
  const qc = useQueryClient();
  const sheetRef = useRef(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const [subjectId, setSubjectId] = useState(note.subjectId ?? '');
  const [subfolder, setSubfolder] = useState(note.subfolder ?? '');

  const { data: folders = [] } = useQuery({
    queryKey: ['subject-folders', subjectId],
    queryFn: () => api.getSubjectFolders(subjectId),
    enabled: !!subjectId,
  });

  const moveMutation = useMutation({
    mutationFn: () => api.patchNoteMeta(note.id, {
      subjectId: subjectId !== note.subjectId ? subjectId : undefined,
      subfolder: subfolder !== (note.subfolder ?? '') ? subfolder : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
    },
  });

  // Fermer sur clic extérieur
  useEffect(() => {
    function onDown(e) {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  // Fermer sur Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hasChanges =
    subjectId !== note.subjectId ||
    subfolder !== (note.subfolder ?? '');

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-[9998] backdrop-blur-[2px]" />

      {/* Sheet (mobile) / Modal centrée (desktop) */}
      <div
        ref={sheetRef}
        className="modal-sheet
          bg-white dark:bg-neutral-900 shadow-2xl
          border border-black/[0.08] dark:border-white/[0.08]
          p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-primary font-semibold text-[15px]">
            <FolderInput size={16} className="text-accent" />
            Déplacer la note
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Matière */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">Matière</label>
          <select
            value={subjectId}
            onChange={e => { setSubjectId(e.target.value); setSubfolder(''); }}
            className="h-10 px-3 rounded-lg text-[14px]
              bg-black/[0.04] dark:bg-white/[0.05]
              border border-black/[0.08] dark:border-white/[0.07]
              text-text-primary focus:outline-none focus:border-accent/40 transition-colors"
          >
            <option value="">— Choisir —</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.emoji ? `${s.emoji} ` : ''}{s.name}</option>
            ))}
          </select>
        </div>

        {/* Sous-dossier */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
            Sous-dossier <span className="normal-case text-text-tertiary font-normal">(optionnel)</span>
          </label>
          <input
            list="move-folders-list"
            type="text"
            value={subfolder}
            onChange={e => setSubfolder(e.target.value)}
            placeholder="ex : Chapitre 3"
            className="h-10 px-3 rounded-lg text-[14px]
              bg-black/[0.04] dark:bg-white/[0.05]
              border border-black/[0.08] dark:border-white/[0.07]
              text-text-primary placeholder:text-text-tertiary
              focus:outline-none focus:border-accent/40 transition-colors"
          />
          {folders.length > 0 && (
            <datalist id="move-folders-list">
              {folders.map(f => <option key={f} value={f} />)}
            </datalist>
          )}
          {subfolder && (
            <button
              type="button"
              onClick={() => setSubfolder('')}
              className="self-start text-[11px] text-text-tertiary hover:text-status-danger transition-colors"
            >
              × Retirer le sous-dossier
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => moveMutation.mutate()}
            disabled={!hasChanges || !subjectId || moveMutation.isPending}
            className="flex-1 h-10 rounded-lg text-[13px] font-medium
              bg-accent text-white hover:bg-accent/90
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {moveMutation.isPending ? 'Déplacement…' : 'Déplacer'}
          </button>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg text-[13px] text-text-secondary
              hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
