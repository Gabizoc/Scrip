import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Edit2, Trash2, Check, X, Columns2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { slugify, extractHeadings, stripFrontmatter, scrollToId } from '../lib/markdownHeadings.js';
import GlassCard from '../components/GlassCard.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import ErrorState from '../components/ErrorState.jsx';
import TableOfContents, { useActiveHeading } from '../components/preview/TableOfContents.jsx';
import { mdComponents } from '../components/preview/markdownComponents.jsx';
import SourcePhotos from '../components/preview/SourcePhotos.jsx';
import SourceCompare from '../components/preview/SourceCompare.jsx';
import PreviewSkeleton from '../components/preview/PreviewSkeleton.jsx';

const COMPARE_KEY = 'scrip.preview.compare';

function readComparePref() {
  try { return localStorage.getItem(COMPARE_KEY) === '1'; } catch { return false; }
}

export default function Preview() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing]         = useState(false);
  const [draft, setDraft]             = useState('');
  const [titleDraft, setTitleDraft]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [compare, setCompare]         = useState(readComparePref);
  const textareaRef = useRef(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['note', noteId], queryFn:  () => api.getNote(noteId), });

  const { data: sources = [] } = useQuery({
    queryKey: ['note-sources', noteId], queryFn: () => api.getNoteSources(noteId), enabled: !!noteId, });

  function toggleCompare() {
    setCompare(v => {
      try { localStorage.setItem(COMPARE_KEY, v ? '0' : '1'); } catch { }
      return !v;
    });
  }

  // La comparaison n'a de sens que s'il y a des photos et un écran assez large.
  const comparing = compare && sources.length > 0;

  useEffect(() => {
    if (data?.markdown) setDraft(data.markdown);
    if (data?.note?.title) setTitleDraft(data.note.title);
  }, [data?.markdown, data?.note?.title]);

  const patchNote = useMutation({
    mutationFn: () => api.patchNoteMeta(noteId, { markdown: draft, title: titleDraft.trim() || undefined }), onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['note', noteId] });
      qc.invalidateQueries({ queryKey: ['notes'] });
      setEditing(false);
    }, });

  const deleteNote = useMutation({
    mutationFn: () => api.deleteNote(noteId), onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      navigate('/');
    }, });

  const lastTapRef = useRef(0);

  const openEditorAt = useCallback((el) => {
    let target = el;
    while (target && target.dataset?.mdzone === undefined) {
      if (/^(H[1-6]|P|LI|TD|TH|BLOCKQUOTE|PRE)$/.test(target.tagName)) break;
      target = target.parentElement;
    }
    const clickedText = target?.textContent?.trim().slice(0, 60) ?? '';

    setEditing(true);

    setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      if (!clickedText) return;

      const lines = draft.split('\n');
      let charPos = 0;
      for (let i = 0; i < lines.length; i++) {
        const clean = lines[i]
          .replace(/^#{1,6}\s*/, '')
          .replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '')
          .replace(/`/g, '').trim();
        if (clean.length > 4 && clickedText.startsWith(clean.slice(0, Math.min(clean.length, 30)))) {
          const lineHeight = ta.scrollHeight / Math.max(lines.length, 1);
          ta.scrollTop = Math.max(0, i * lineHeight - 80);
          ta.setSelectionRange(charPos, charPos + lines[i].length);
          return;
        }
        charPos += lines[i].length + 1;
      }
    }, 60);
  }, [draft]);

  const handleContentDblClick = useCallback((e) => {
    if (editing) return;
    openEditorAt(e.target);
  }, [editing, openEditorAt]);

  const handleContentTouchEnd = useCallback((e) => {
    if (editing) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      openEditorAt(e.target);
    }
    lastTapRef.current = now;
  }, [editing, openEditorAt]);

  const handleHeadingClick = useCallback((id) => {
    if (editing) {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = draft.split('\n');
      let charPos = 0;
      for (const line of lines) {
        const m = line.match(/^(#{1,6})\s+(.+)$/);
        if (m) {
          const text = m[2].trim()
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            .replace(/`(.+?)`/g, '$1');
          if (slugify(text) === id) {
            const linesBefore = draft.substring(0, charPos).split('\n').length - 1;
            const lineHeight = ta.scrollHeight / lines.length;
            ta.scrollTop = Math.max(0, linesBefore * lineHeight - 60);
            ta.focus();
            ta.setSelectionRange(charPos, charPos);
            return;
          }
        }
        charPos += line.length + 1;
      }
    } else {
      scrollToId(id);
    }
  }, [editing, draft]);

  const markdown = stripFrontmatter(data?.markdown ?? '');
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const headingIds = useMemo(() => headings.map(h => h.id), [headings]);
  const activeId = useActiveHeading(headingIds);

  if (isLoading) return <PreviewSkeleton />;
  if (error) return <ErrorState message="Impossible de charger ce cours." />;

  return (
    <div className="px-4 py-6 md:py-8">
      <div className="flex gap-8 justify-center max-w-[88rem] mx-auto">

        {comparing && (
          <aside className="hidden lg:block lg:w-1/2 shrink-0">
            <SourceCompare sources={sources} />
          </aside>
        )}

        <div className={['w-full min-w-0', comparing ? 'lg:flex-1' : 'max-w-3xl'].join(' ')}>

          <div className="flex items-center justify-between mb-5 gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-sm text-text-secondary
                hover:text-text-primary transition-colors"
            >
              <ArrowLeft size={15} />
              Mes cours
            </button>
            <div className="flex items-center gap-2">
              {sources.length > 0 && (
                <button
                  onClick={toggleCompare}
                  title="Afficher la photo originale à côté de la note"
                  className={[
                    'hidden lg:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors',
                    compare
                      ? 'text-accent border-accent/40 bg-accent/10'
                      : 'text-text-secondary hover:text-text-primary border-black/[0.08] dark:border-white/10',
                  ].join(' ')}
                >
                  <Columns2 size={14} /> Comparer
                </button>
              )}
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 text-sm text-text-secondary
                      hover:text-text-primary px-3 py-1.5 rounded-md
                      border border-black/[0.08] dark:border-white/10 transition-colors"
                  >
                    <X size={14} /> Annuler
                  </button>
                  <button
                    onClick={() => patchNote.mutate()}
                    disabled={patchNote.isPending}
                    className="flex items-center gap-1.5 text-sm text-white
                      bg-accent hover:bg-accent/90 px-3 py-1.5 rounded-md
                      transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={14} /> Sauvegarder
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-sm text-text-secondary
                      hover:text-text-primary px-3 py-1.5 rounded-md
                      border border-black/[0.08] dark:border-white/10 transition-colors"
                  >
                    <Edit2 size={14} /> Éditer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-sm text-status-danger
                      hover:text-status-danger/70 px-3 py-1.5 rounded-md
                      border border-status-danger/20 transition-colors"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </>
              )}
            </div>
          </div>

          {data?.note && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent">
                {data.note.subject ?? data.note.subjectId}
              </span>
              <span className="text-xs text-text-tertiary">
                {data.note.level ?? data.note.levelId}
              </span>
              {data.note.createdAt && (
                <span className="text-xs text-text-tertiary ml-auto">
                  {new Date(data.note.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric', })}
                </span>
              )}
            </div>
          )}

          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="Titre du cours…"
                className="w-full px-4 py-2.5 rounded-xl bg-bg-elevated
                  border border-black/[0.08] dark:border-white/[0.06]
                  text-text-primary font-semibold text-base
                  focus:outline-none focus:border-accent/50 transition-colors"
              />
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full h-[68vh] p-5 rounded-xl bg-bg-elevated
                  border border-black/[0.08] dark:border-white/[0.06]
                  text-text-primary font-mono text-sm leading-relaxed
                  resize-none focus:outline-none focus:border-accent/50 transition-colors"
              />
              {patchNote.isError && (
                <p className="text-sm text-status-danger bg-status-danger/10 rounded-md px-3 py-2">
                  Sauvegarde impossible : {patchNote.error.message}
                </p>
              )}
            </div>
          ) : (
            <GlassCard
              className="p-6 md:p-8 group/preview relative cursor-text"
              onDoubleClick={handleContentDblClick}
              onTouchEnd={handleContentTouchEnd}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {markdown}
              </ReactMarkdown>
              <span className="absolute bottom-3 right-4
                text-[10px] text-text-tertiary opacity-0
                group-hover/preview:opacity-60 transition-opacity duration-300
                pointer-events-none select-none hidden md:block">
                double-clic pour éditer
              </span>
            </GlassCard>
          )}

          {!editing && (
            <div className={comparing ? 'lg:hidden' : ''}>
              <SourcePhotos noteId={noteId} />
            </div>
          )}
        </div>

        {headings.length > 1 && !comparing && (
          <aside className="hidden lg:block w-52 flex-shrink-0">
            <div className="sticky top-8 pt-[3.75rem]">
              <TableOfContents headings={headings} activeId={activeId} onHeadingClick={handleHeadingClick} />
            </div>
          </aside>
        )}

      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer ce cours ?"
          message={`« ${data?.note?.title} » sera déplacé vers la corbeille. Vous pourrez le restaurer depuis Paramètres › Corbeille.`}
          confirmLabel="Supprimer"
          onConfirm={() => { setConfirmDelete(false); deleteNote.mutate(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
