// frontend/src/pages/Preview.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Edit2, Trash2, Check, X, ChevronDown, ImageIcon } from 'lucide-react';
import { api } from '../lib/api.js';
import GlassCard from '../components/GlassCard.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

// Extrait le texte brut d'un nœud hast (react-markdown)
function nodeToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (Array.isArray(node.children)) return node.children.map(nodeToText).join('');
  return '';
}

// Extrait les titres H1–H6 du markdown brut pour la TOC
function extractHeadings(markdown = '') {
  return markdown.split('\n').map(line => {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) return null;
    // Supprime les marqueurs inline (**bold**, _italic_, `code`)
    const text = m[2].trim()
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1');
    return { level: m[1].length, text, id: slugify(text) };
  }).filter(Boolean);
}

function stripFrontmatter(markdown = '') {
  return markdown.replace(/^---\n[\s\S]*?\n---\n*/m, '').trimStart();
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 88;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

// ── Hook : heading actif via IntersectionObserver ─────────────────────────────

function useActiveHeading(ids) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!ids.length) return;
    const obs = new IntersectionObserver(
      entries => {
        const hit = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveId(hit.target.id);
      },
      { rootMargin: '-5% 0px -75% 0px', threshold: 0 },
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);

  return activeId;
}

// ── Composant TOC ─────────────────────────────────────────────────────────────

// Indentation TOC par niveau : H1=0, H2=12px, H3=24px, H4=36px…
const TOC_INDENT = [0, 0, 12, 24, 36, 48, 60];

function TableOfContents({ headings, activeId, onHeadingClick }) {
  if (!headings.length) return null;
  return (
    <nav aria-label="Table des matières">
      <p className="text-[9px] uppercase tracking-widest font-semibold text-text-tertiary mb-3">
        Chapitres
      </p>
      <ul className="space-y-px">
        {headings.map(({ level, text, id }) => {
          const indent = TOC_INDENT[Math.min(level, 6)] ?? 60;
          return (
            <li key={id}>
              <button
                onClick={() => onHeadingClick(id)}
                title={text}
                style={{ paddingLeft: `${indent + 8}px` }}
                className={[
                  'w-full text-left leading-snug py-1.5 pr-2 rounded-md',
                  'transition-all duration-150 truncate block',
                  level === 1 ? 'text-[11px]' : level === 2 ? 'text-[10.5px]' : 'text-[10px]',
                  activeId === id
                    ? 'text-accent font-semibold bg-accent/[0.08]'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
                ].join(' ')}
              >
                {level >= 3 && (
                  <span className="mr-1 opacity-30">{'·'.repeat(level - 2)}</span>
                )}
                {text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── Composants Markdown ───────────────────────────────────────────────────────

const mdComponents = {
  h1: ({ children, node }) => (
    <h1 id={slugify(nodeToText(node))}
      className="text-2xl font-bold text-text-primary mt-8 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children, node }) => (
    <h2 id={slugify(nodeToText(node))}
      className="text-lg font-semibold text-text-primary mt-6 mb-3 ml-4
        border-l-[3px] border-accent pl-3 rounded-sm">
      {children}
    </h2>
  ),
  h3: ({ children, node }) => (
    <h3 id={slugify(nodeToText(node))}
      className="text-base font-semibold text-text-secondary mt-4 mb-2 ml-8
        border-l-2 border-accent/40 pl-3 rounded-sm">
      {children}
    </h3>
  ),
  h4: ({ children, node }) => (
    <h4 id={slugify(nodeToText(node))}
      className="text-sm font-semibold text-text-secondary mt-3 mb-1.5 ml-12
        border-l border-accent/25 pl-3">
      {children}
    </h4>
  ),
  h5: ({ children, node }) => (
    <h5 id={slugify(nodeToText(node))}
      className="text-sm font-medium text-text-tertiary mt-2 mb-1 ml-16 pl-3">
      {children}
    </h5>
  ),
  h6: ({ children, node }) => (
    <h6 id={slugify(nodeToText(node))}
      className="text-xs font-medium text-text-tertiary mt-2 mb-1 ml-20 pl-3">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="text-[15px] text-text-primary leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => <ul className="mb-3 space-y-1 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 space-y-1 pl-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="text-[15px] text-text-primary leading-relaxed flex gap-2 items-start [&>ol]:mt-1 [&>ul]:mt-1">
      <span className="mt-[6px] shrink-0 w-1.5 h-1.5 rounded-full bg-accent/60" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
  hr: () => (
    <div className="my-6 flex items-center gap-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </div>
  ),
  table: ({ children }) => (
    <div className="table-scroll-wrapper my-4 overflow-x-auto rounded-lg border border-black/[0.08] dark:border-white/[0.08]"
      style={{ scrollbarGutter: 'stable' }}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-accent/[0.08] dark:bg-accent/10">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-[14px] text-text-primary align-top">{children}</td>
  ),
  code: ({ children, className }) => {
    if (className) return (
      <pre className="my-3 p-4 rounded-lg bg-bg-elevated border border-black/[0.06] dark:border-white/[0.06] overflow-x-auto text-sm font-mono text-text-primary">
        <code>{children}</code>
      </pre>
    );
    return <code className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono text-[13px]">{children}</code>;
  },
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 border-l-2 border-accent/40 text-text-secondary italic text-[14px]">
      {children}
    </blockquote>
  ),
};

// ── Lightbox avec zoom ────────────────────────────────────────────────────────

const MIN_ZOOM = 1, MAX_ZOOM = 8;

function Lightbox({ sources, index, onClose, onPrev, onNext }) {
  const [zoom, setZoom]             = useState(1);
  const [pan, setPan]               = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); // ref pour les handlers (pas de closure stale)
  const lastPos       = useRef({ x: 0, y: 0 });
  const didDrag       = useRef(false);
  const lastPinchDist = useRef(null);

  // Reset zoom/pan quand on change de photo
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [index]);

  // Clavier
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   onPrev?.();
      if (e.key === 'ArrowRight')  onNext?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  // ── Zoom molette ──────────────────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }

  // ── Double-clic ───────────────────────────────────────────────────────────
  function onDblClick(e) {
    e.stopPropagation();
    if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); }
    else setZoom(2.5);
  }

  // ── Drag via Pointer Events + capture ────────────────────────────────────
  // setPointerCapture route tous les events vers cet élément, même si le pointeur
  // sort de l'image — résout le problème de mousemove manqué sur l'overlay.
  function onPointerDown(e) {
    if (zoom <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    didDrag.current = false;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    didDrag.current = true;
    setPan(p => ({
      x: p.x + e.clientX - lastPos.current.x,
      y: p.y + e.clientY - lastPos.current.y,
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (didDrag.current) e.stopPropagation();
  }

  // ── Pinch / tactile ───────────────────────────────────────────────────────
  function onTouchStart(e) {
    if (e.touches.length === 1)
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.touches.length === 2)
      lastPinchDist.current = null;
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastPinchDist.current !== null) {
        setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * dist / lastPinchDist.current)));
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && zoom > 1) {
      const t = e.touches[0];
      setPan(p => ({
        x: p.x + t.clientX - lastPos.current.x,
        y: p.y + t.clientY - lastPos.current.y,
      }));
      lastPos.current = { x: t.clientX, y: t.clientY };
    }
  }
  function onTouchEnd() { lastPinchDist.current = null; }

  const isZoomed = zoom > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none"
      onClick={() => { if (!isZoomed && !didDrag.current) onClose(); }}
    >
      {/* Barre du haut */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white/50 text-xs font-mono tabular-nums">
          {sources.length > 1 ? `${index + 1} / ${sources.length}` : ''}
        </p>
        <div className="flex items-center gap-2">
          {isZoomed && (
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="text-[11px] text-white/60 bg-white/10 hover:bg-white/20
                px-2 py-1 rounded font-mono transition-colors"
            >
              {Math.round(zoom * 100)}% — reset
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 text-white
              flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Zone image */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <img
          src={sources[index]?.url}
          alt={`Photo ${index + 1}`}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDblClick={onDblClick}
          onClick={e => { if (didDrag.current) e.stopPropagation(); }}
          style={{
            transform:       `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            transition:      isDragging ? 'none' : 'transform 0.12s ease',
            cursor:          isDragging ? 'grabbing' : isZoomed ? 'grab' : 'zoom-in',
            maxHeight:       '100vh',
            maxWidth:        '100vw',
            objectFit:       'contain',
            userSelect:      'none',
            pointerEvents:   'auto',
          }}
        />
      </div>

      {/* Hint */}
      {!isZoomed && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2
          text-white/25 text-[11px] pointer-events-none">
          double-clic ou molette pour zoomer
        </p>
      )}

      {/* Nav prev/next */}
      {sources.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2
              w-10 h-10 rounded-full bg-white/10 text-white text-xl
              flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >‹</button>
          <button
            onClick={e => { e.stopPropagation(); onNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2
              w-10 h-10 rounded-full bg-white/10 text-white text-xl
              flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >›</button>
        </>
      )}
    </div>,
    document.body,
  );
}

// ── Photos originales ─────────────────────────────────────────────────────────

function SourcePhotos({ noteId }) {
  const [open, setOpen]       = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['note-sources', noteId],
    queryFn:  () => api.getNoteSources(noteId),
    enabled:  !!noteId,
  });

  if (!isLoading && sources.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors w-full"
      >
        <ImageIcon size={13} />
        <span className="font-medium">
          {isLoading ? 'Photos originales…' : `${sources.length} photo${sources.length > 1 ? 's' : ''} originale${sources.length > 1 ? 's' : ''}`}
        </span>
        <ChevronDown size={13} className={`ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sources.map((src, i) => (
            <button
              key={src.filename}
              onClick={() => setLightbox(i)}
              className="relative group aspect-[3/4] rounded-lg overflow-hidden
                ring-1 ring-black/[0.08] dark:ring-white/[0.08]
                hover:ring-accent/50 transition-all duration-150"
            >
              <img
                src={src.url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div className="absolute bottom-1.5 left-1.5
                bg-black/60 text-white text-[10px] font-semibold
                px-1.5 py-0.5 rounded leading-none">
                {i + 1}
              </div>
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          sources={sources}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(i => (i - 1 + sources.length) % sources.length)}
          onNext={() => setLightbox(i => (i + 1) % sources.length)}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Preview() {
  const { noteId } = useParams();
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const [editing, setEditing]         = useState(false);
  const [draft, setDraft]             = useState('');
  const [titleDraft, setTitleDraft]   = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef                 = useRef(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['note', noteId],
    queryFn:  () => api.getNote(noteId),
  });

  useEffect(() => {
    if (data?.markdown) setDraft(data.markdown);
    if (data?.note?.title) setTitleDraft(data.note.title);
  }, [data?.markdown, data?.note?.title]);

  const patchNote = useMutation({
    mutationFn: () => api.patchNoteMeta(noteId, { markdown: draft, title: titleDraft.trim() || undefined }),
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

  // ── Double-clic / double-tap → ouvre éditeur au bon endroit ─────────────────
  const lastTapRef = useRef(0);

  const openEditorAt = useCallback((el) => {
    // Remonte jusqu'au premier bloc significatif (heading, p, li, td…)
    let target = el;
    while (target && target.dataset?.mdzone === undefined) {
      if (/^(H[1-6]|P|LI|TD|TH|BLOCKQUOTE|PRE)$/.test(target.tagName)) break;
      target = target.parentElement;
    }
    const clickedText = target?.textContent?.trim().slice(0, 60) ?? '';

    setEditing(true);

    // Attend que le textarea soit monté puis scroll au bon endroit
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

  // Double-tap mobile (deux touches < 300 ms)
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
      // Trouve le numéro de ligne du heading dans le draft
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
            const lineHeight  = ta.scrollHeight / lines.length;
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

  const markdown    = stripFrontmatter(data?.markdown ?? '');
  const headings    = useMemo(() => extractHeadings(markdown), [markdown]);
  const headingIds  = useMemo(() => headings.map(h => h.id), [headings]);
  const activeId    = useActiveHeading(headingIds);

  if (isLoading) return (
    <div className="px-4 py-6 md:py-8 animate-pulse">
      <div className="flex gap-8 justify-center max-w-[88rem] mx-auto">
        <div className="w-full max-w-3xl min-w-0">

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5">
            <div className="h-4 w-20 rounded-full bg-black/[0.06] dark:bg-white/[0.07]" />
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-md bg-black/[0.05] dark:bg-white/[0.06]" />
              <div className="h-8 w-24 rounded-md bg-black/[0.05] dark:bg-white/[0.06]" />
            </div>
          </div>

          {/* Méta */}
          <div className="flex items-center gap-2 mb-6">
            <div className="h-5 w-16 rounded-full bg-accent/20" />
            <div className="h-3.5 w-12 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
            <div className="ml-auto h-3.5 w-28 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
          </div>

          {/* Carte contenu */}
          <div className="rounded-2xl border border-black/[0.07] dark:border-white/[0.07] bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 space-y-5">
            {/* Titre H1 */}
            <div className="h-6 w-3/4 rounded-full bg-black/[0.08] dark:bg-white/[0.10]" />

            {/* Sous-titre H2 */}
            <div className="pt-2 space-y-3">
              <div className="h-4 w-2/5 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              {/* Paragraphe */}
              <div className="space-y-2">
                {[100, 92, 97, 85, 100, 60].map((w, i) => (
                  <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            {/* Deuxième section */}
            <div className="pt-2 space-y-3">
              <div className="h-4 w-1/3 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="space-y-2">
                {[95, 100, 88, 72].map((w, i) => (
                  <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            {/* Troisième section — fade */}
            <div className="pt-2 space-y-3 opacity-50">
              <div className="h-4 w-2/5 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="space-y-2">
                {[100, 90, 78].map((w, i) => (
                  <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            <div className="opacity-20 space-y-2">
              {[94, 65].map((w, i) => (
                <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar TOC — desktop uniquement */}
        <div className="hidden xl:block w-52 shrink-0 space-y-2 pt-16">
          {[60, 45, 55, 40, 50].map((w, i) => (
            <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{ width: `${w}%`, opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
    </div>
  );
  if (error)     return <div className="p-8 text-status-danger text-sm">{error.message}</div>;

  return (
    <div className="px-4 py-6 md:py-8">
      <div className="flex gap-8 justify-center max-w-[88rem] mx-auto">

        {/* ── Contenu principal ───────────────────────────────────── */}
        <div className="w-full max-w-3xl min-w-0">

          {/* Toolbar */}
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

          {/* Méta */}
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
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              )}
            </div>
          )}

          {/* Contenu / Éditeur */}
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
              {/* Hint discret */}
              <span className="absolute bottom-3 right-4
                text-[10px] text-text-tertiary opacity-0
                group-hover/preview:opacity-60 transition-opacity duration-300
                pointer-events-none select-none hidden md:block">
                double-clic pour éditer
              </span>
            </GlassCard>
          )}

          {/* ── Photos originales ─────────────────────────────────── */}
          {!editing && <SourcePhotos noteId={noteId} />}
        </div>

        {/* ── TOC sidebar — desktop xl+ ───────────────────────────── */}
        {headings.length > 1 && (
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
          message={`« ${data?.note?.title} » sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          onConfirm={() => { setConfirmDelete(false); deleteNote.mutate(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
