import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, PenLine, ChevronDown, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import SubjectIcon from './SubjectIcon.jsx';
import { subjectIcon } from '../lib/noteUtils.js';

function CustomSelect({ value, onChange, options, placeholder = 'Choisir…' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-10 px-3 flex items-center justify-between gap-2 rounded-lg text-[14px]
          bg-black/[0.04] dark:bg-white/[0.05]
          border border-black/[0.08] dark:border-white/[0.07]
          text-text-primary hover:border-accent/40 focus:outline-none focus:border-accent/40
          transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <SubjectIcon value={selected.icon || null} fallback={subjectIcon(selected.name, null)} size={15} />
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-text-tertiary">{placeholder}</span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-tertiary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul className="absolute z-[10001] mt-1 w-full rounded-lg overflow-hidden
          bg-white dark:bg-neutral-800
          border border-black/[0.08] dark:border-white/[0.08]
          shadow-xl shadow-black/10 dark:shadow-black/40
          max-h-52 overflow-y-auto"
        >
          <li>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px]
                text-text-tertiary hover:bg-accent/10 hover:text-accent
                transition-colors text-left italic"
            >
              <span className="flex-1">Aucune matière</span>
              {!value && <Check size={12} className="shrink-0 text-accent" />}
            </button>
          </li>
          {options.map(o => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px]
                  text-text-primary hover:bg-accent/10 hover:text-accent
                  transition-colors text-left"
              >
                <SubjectIcon value={o.icon || null} fallback={subjectIcon(o.name, null)} size={15} />
                <span className="flex-1 truncate">{o.name}</span>
                {String(o.value) === String(value) && (
                  <Check size={12} className="shrink-0 text-accent" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CreateNoteSheet({ onClose }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'], queryFn: () => api.getSubjects(), });

  const [title, setTitle]     = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [markdown, setMarkdown]  = useState('');

  const { data: folders = [] } = useQuery({
    queryKey: ['subject-folders', subjectId], queryFn: () => api.getSubjectFolders(subjectId), enabled: !!subjectId, });

  const createMutation = useMutation({
    mutationFn: () => api.createNote({
      title: title.trim(), subjectId: subjectId || undefined, subfolder: subfolder.trim() || undefined, markdown:  markdown.trim() || undefined, }), onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      onClose();
      navigate(`/preview/${note.id}`);
    }, });

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const subjectOptions = subjects.map(s => ({
    value: s.id, name:  s.name, icon:  s.emoji ?? null, }));

  const canSubmit = title.trim().length > 0 && !createMutation.isPending;

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate();
  }

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-[9998] backdrop-blur-[2px]" />

      <div className="modal-wrapper" onClick={onClose}>
        <form
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className="modal-sheet
            bg-white dark:bg-neutral-900 shadow-2xl
            border border-black/[0.08] dark:border-white/[0.08]
            p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-[15px]">
              <PenLine size={16} className="text-accent" />
              Nouveau cours
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Titre <span className="text-status-danger">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ex : La Révolution française"
              className="h-10 px-3 rounded-lg text-[14px]
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.08] dark:border-white/[0.07]
                text-text-primary placeholder:text-text-tertiary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Matière <span className="normal-case text-text-tertiary font-normal">(optionnel)</span>
            </label>
            <CustomSelect
              value={subjectId}
              onChange={v => { setSubjectId(v); setSubfolder(''); }}
              options={subjectOptions}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Sous-dossier <span className="normal-case text-text-tertiary font-normal">(optionnel)</span>
            </label>
            <input
              list="create-folders-list"
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
              <datalist id="create-folders-list">
                {folders.map(f => <option key={f} value={f} />)}
              </datalist>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Contenu <span className="normal-case text-text-tertiary font-normal">(optionnel · modifiable ensuite)</span>
            </label>
            <textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              placeholder={'# Titre\n\n## Section 1\n\n…'}
              rows={5}
              className="px-3 py-2.5 rounded-lg text-[13px] font-mono leading-relaxed resize-none
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.08] dark:border-white/[0.07]
                text-text-primary placeholder:text-text-tertiary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {createMutation.isError && (
            <p className="text-[12px] text-status-danger">
              {createMutation.error?.message ?? 'Une erreur est survenue.'}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 h-10 rounded-lg text-[13px] font-medium
                bg-accent text-white hover:bg-accent/90
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? 'Création…' : 'Créer le cours'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-[13px] text-text-secondary
                hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </>, document.body, );
}
