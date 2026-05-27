// frontend/src/components/NoteListRow.jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, MoreHorizontal, Trash2, FolderInput } from 'lucide-react';
import { parseScore, scoreColor, subjectColor, subjectColorStyle, subjectDotColor, relativeDate } from '../lib/noteUtils.js';
import SubjectEditor from './SubjectEditor.jsx';
import MoveNoteSheet from './MoveNoteSheet.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { useSubjectByName } from '../lib/SubjectsContext.jsx';
import { api } from '../lib/api.js';

const SWIPE_REVEAL  = 72;  // px — largeur du bouton suppression révélé
const SWIPE_TRIGGER = 55;  // px — distance minimale pour déclencher l'ouverture

export default function NoteListRow({ note, snippet = null, hideSubfolder = false }) {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const subjectData = useSubjectByName(note.subject);
  const score       = parseScore(note.metadata?.qualite_francais);
  const dot         = subjectDotColor(note.subject ?? '', subjectData?.color ?? null);
  const customStyle = subjectColorStyle(subjectData?.color ?? null);

  const [editorRect, setEditorRect]       = useState(null);
  const [showMove, setShowMove]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu]           = useState(false);
  const [menuPos, setMenuPos]             = useState({ top: 0, right: 0 });
  const menuBtnRef                        = useRef(null);
  const menuRef                           = useRef(null);

  // Fermer le menu sur clic extérieur
  useEffect(() => {
    if (!showMenu) return;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [showMenu]);

  function openMenu(e) {
    e.stopPropagation();
    const rect = menuBtnRef.current.getBoundingClientRect();
    setMenuPos({
      top:   rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setShowMenu(o => !o);
  }

  // ── Swipe delete ────────────────────────────────────────────────────────────
  const touchStartX    = useRef(0);
  const swipeXAtStart  = useRef(0);   // position au moment du touchstart
  const [swipeX, setSwipeX]         = useState(0);
  const [isSwiping, setIsSwiping]   = useState(false);

  // Swipe uniquement sur mobile (pointer coarse = écran tactile)
  const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

  function onTouchStart(e) {
    if (!isTouchDevice()) return;
    touchStartX.current   = e.touches[0].clientX;
    swipeXAtStart.current = swipeX;   // mémorise la position actuelle
    setIsSwiping(true);
  }
  function onTouchMove(e) {
    if (!isSwiping) return;
    const dx   = e.touches[0].clientX - touchStartX.current;
    const next = swipeXAtStart.current + dx;
    setSwipeX(Math.min(0, Math.max(next, -SWIPE_REVEAL)));
  }
  function onTouchEnd() {
    if (!isSwiping) return;
    setIsSwiping(false);
    // Snap : si on a glissé au-delà du trigger → ouvrir, sinon fermer
    if (swipeX <= -SWIPE_TRIGGER) {
      setSwipeX(-SWIPE_REVEAL);
    } else {
      setSwipeX(0);
    }
  }

  function closeSwipe() { setSwipeX(0); }

  // ── Delete mutation ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteNote(note.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  return (
    <div className="relative overflow-hidden">
      {/* Fond rouge pour swipe delete — mobile uniquement */}
      <div
        className="md:hidden absolute inset-y-0 right-0 flex items-center justify-center bg-status-danger"
        style={{ width: SWIPE_REVEAL }}
      >
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
          className="flex flex-col items-center gap-0.5 text-white px-3"
          disabled={deleteMutation.isPending}
          aria-label="Supprimer"
        >
          <Trash2 size={16} />
          <span className="text-[9px] font-medium">Suppr.</span>
        </button>
      </div>

      {/* Ligne principale */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (swipeX !== 0) { closeSwipe(); return; } navigate(`/preview/${note.id}`); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/preview/${note.id}`); }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label={`Ouvrir le cours : ${note.title}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y',
        }}
        className="group relative flex items-center gap-3 px-4 py-2.5 cursor-pointer
          transition-colors duration-300 ease-out
          hover:bg-black/[0.025] dark:hover:bg-white/[0.035]
          bg-white dark:bg-neutral-950"
      >
        {/* Accent left bar on hover */}
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full
          opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: dot }}
        />

        {/* Dot matière */}
        <span
          className="flex-shrink-0 w-[7px] h-[7px] rounded-full ml-1"
          style={{ background: dot }}
        />

        {/* Titre + sous-dossier + snippet */}
        <span className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-[13px] font-medium text-text-primary truncate">
            {note.title}
          </span>
          {note.subfolder && !hideSubfolder && (
            <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary leading-none mt-0.5">
              <FolderOpen size={9} className="shrink-0 opacity-50" />
              <span className="truncate opacity-70">{note.subfolder}</span>
            </span>
          )}
          {snippet && (
            <span className="text-[10px] text-text-tertiary italic truncate mt-0.5 opacity-80">
              {snippet}
            </span>
          )}
        </span>

        {/* Matière (masquée sur mobile) */}
        <span className="hidden md:inline-flex shrink-0 w-[90px] justify-center">
          <button
            onClick={e => { e.stopPropagation(); setEditorRect(e.currentTarget.getBoundingClientRect()); }}
            title="Modifier la matière"
            className={[
              'text-[10px] font-semibold px-2 py-0.5 rounded-md truncate transition',
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
        </span>

        {/* Date */}
        <span className="hidden md:block shrink-0 w-[80px] text-right text-[11px] text-text-tertiary tabular-nums">
          {relativeDate(note.createdAt)}
        </span>

        {/* Score */}
        <span className="shrink-0 w-[44px] text-right">
          {score != null && (
            <span className={`text-xs font-semibold font-mono ${scoreColor(score)}`}>
              {score}
            </span>
          )}
        </span>

        {/* ⋯ Menu contextuel */}
        <button
          ref={menuBtnRef}
          onClick={openMenu}
          aria-label="Actions"
          className="shrink-0 p-1.5 rounded-md text-text-tertiary
            opacity-100 md:opacity-0 md:group-hover:opacity-100
            hover:text-accent hover:bg-accent/10 transition-all duration-150"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Menu contextuel ⋯ — rendu via portal pour échapper à overflow-hidden */}
      {showMenu && createPortal(
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
          className="w-36
            bg-white dark:bg-neutral-800
            border border-black/[0.08] dark:border-white/[0.08]
            rounded-lg shadow-lg shadow-black/10 dark:shadow-black/40
            overflow-hidden py-1"
        >
          <button
            onClick={() => { setShowMenu(false); setShowMove(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px]
              text-text-primary hover:bg-accent/10 hover:text-accent
              transition-colors text-left"
          >
            <FolderInput size={13} className="shrink-0" />
            Déplacer
          </button>
          <div className="mx-2 border-t border-black/[0.06] dark:border-white/[0.06]" />
          <button
            onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px]
              text-status-danger hover:bg-status-danger/10
              transition-colors text-left"
          >
            <Trash2 size={13} className="shrink-0" />
            Supprimer
          </button>
        </div>,
        document.body,
      )}

      {/* Sheet de déplacement */}
      {showMove && (
        <MoveNoteSheet note={note} onClose={() => setShowMove(false)} />
      )}

      {/* Confirmation suppression */}
      {confirmDelete && (
        <ConfirmModal
          title="Supprimer ce cours ?"
          message={`« ${note.title} » sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          onConfirm={() => { setConfirmDelete(false); deleteMutation.mutate(); }}
          onCancel={() => { setConfirmDelete(false); closeSwipe(); }}
        />
      )}
    </div>
  );
}
