// frontend/src/pages/Home.jsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Search, X, ChevronDown, List, LayoutGrid } from 'lucide-react';
import { api } from '../lib/api.js';
import { parseScore } from '../lib/noteUtils.js';
import NoteCard from '../components/NoteCard.jsx';
import NoteListRow from '../components/NoteListRow.jsx';
import RecentStrip from '../components/RecentStrip.jsx';
import SubjectSidebar from '../components/SubjectSidebar.jsx';

// ── Constantes ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'date-desc',  label: 'Plus récent' },
  { value: 'date-asc',   label: 'Plus ancien' },
  { value: 'score-desc', label: 'Meilleur score' },
  { value: 'title-asc',  label: 'A → Z' },
];

// ── SortSelect ────────────────────────────────────────────────────────────────

function SortSelect({ value, onChange }) {
  return (
    <div className="relative flex-shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs font-medium
          bg-black/[0.05] dark:bg-white/[0.07] text-text-secondary
          hover:bg-black/[0.09] dark:hover:bg-white/[0.12]
          focus:outline-none focus:ring-2 focus:ring-accent/30 transition cursor-pointer"
      >
        {SORT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
    </div>
  );
}

// ── ViewToggle ────────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }) {
  const btn = (v, Icon, label) => (
    <button
      onClick={() => onChange(v)}
      aria-label={label}
      className={[
        'p-1.5 rounded-md transition-all duration-150',
        view === v
          ? 'bg-accent/20 text-accent'
          : 'text-text-tertiary hover:text-text-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
      ].join(' ')}
    >
      <Icon size={15} />
    </button>
  );
  return (
    <div className="flex gap-0.5">
      {btn('list', List, 'Vue liste')}
      {btn('cards', LayoutGrid, 'Vue cards')}
    </div>
  );
}

// ── ListHeader ────────────────────────────────────────────────────────────────

function ListHeader() {
  return (
    <div className="hidden md:flex items-center gap-3 px-4 py-2.5 border-b border-black/[0.05] dark:border-white/[0.06] text-[10px] uppercase tracking-widest text-text-tertiary font-semibold select-none bg-black/[0.02] dark:bg-white/[0.02]">
      <span className="w-[7px] ml-1 flex-shrink-0" />
      <span className="flex-1">Titre</span>
      <span className="w-[90px] text-center">Matière</span>
      <span className="w-[80px] text-right">Date</span>
      <span className="w-[44px] text-right">Score</span>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Home() {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getNotes,
  });

  const [activeSubject, setActiveSubject] = useState(null);
  const [search, setSearch]               = useState('');
  const [sort, setSort]                   = useState('date-desc');
  const [view, setView]                   = useState(
    () => localStorage.getItem('scrip-home-view') ?? 'list',
  );

  // Persister la préférence de vue
  useEffect(() => {
    localStorage.setItem('scrip-home-view', view);
  }, [view]);

  // Réinitialiser la recherche quand on change de dossier
  useEffect(() => { setSearch(''); }, [activeSubject]);

  const subjects = useMemo(() => {
    const map = new Map();
    for (const n of notes) {
      if (n.subject) map.set(n.subject, (map.get(n.subject) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = notes.filter(n => {
      if (activeSubject && n.subject !== activeSubject) return false;
      if (!q) return true;
      return n.title?.toLowerCase().includes(q) || n.subject?.toLowerCase().includes(q);
    });
    return [...result].sort((a, b) => {
      if (sort === 'date-desc')  return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === 'date-asc')   return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === 'score-desc') return (parseScore(b.metadata?.qualite_francais) ?? -1) - (parseScore(a.metadata?.qualite_francais) ?? -1);
      if (sort === 'title-asc')  return (a.title ?? '').localeCompare(b.title ?? '', 'fr');
      return 0;
    });
  }, [notes, search, activeSubject, sort]);

  const folderTitle  = activeSubject ?? 'Tous les cours';
  const hasNotes    = !isLoading && notes.length > 0;

  return (
    <div className="flex flex-col h-screen px-3 pt-3 pb-0 sm:px-5 sm:pt-5 lg:px-8 lg:pt-6 max-w-screen-2xl mx-auto" style={{ overflow: 'clip' }}>

      {/* ── Bande récents ── */}
      {hasNotes && (
        <div className="flex-shrink-0">
          <RecentStrip notes={notes} />
        </div>
      )}

      {/* ── Chips mobile matières ── */}
      {hasNotes && (
        <div className="md:hidden flex-shrink-0 mb-2">
          <SubjectSidebar
            subjects={subjects}
            activeSubject={activeSubject}
            onSelect={setActiveSubject}
            totalCount={notes.length}
            mobileOnly
          />
        </div>
      )}

      {/* ── Body : sidebar desktop + contenu ── */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Sidebar desktop uniquement */}
        {hasNotes && (
          <div className="hidden md:block flex-shrink-0">
            <SubjectSidebar
              subjects={subjects}
              activeSubject={activeSubject}
              onSelect={setActiveSubject}
              totalCount={notes.length}
              desktopOnly
            />
          </div>
        )}

        {/* Zone principale */}
        <div className="flex-1 min-w-0 overflow-y-auto pt-2 px-3 pb-6 -mx-3">

          {/* Skeleton loading */}
          {isLoading && (
            <div className="space-y-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state — aucun cours du tout */}
          {!isLoading && notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Camera size={28} className="text-accent" strokeWidth={1.5} />
              </div>
              <p className="text-text-primary font-medium mb-1">Aucun cours</p>
              <p className="text-text-secondary text-sm">Capture ta première photo pour commencer</p>
            </div>
          )}

          {/* Contenu */}
          {hasNotes && (
            <>
              {/* Header : titre + recherche + tri + toggle */}
              <div className="flex items-center gap-2 mb-3">
                {/* Titre */}
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary flex-shrink-0">
                  {folderTitle}
                  <span className="ml-0.5 text-text-tertiary font-normal text-xs">{filtered.length}</span>
                </h2>

                {/* Recherche — prend tout l'espace */}
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Rechercher…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 rounded-full text-xs
                      bg-black/[0.05] dark:bg-white/[0.07] text-text-primary placeholder:text-text-tertiary
                      focus:outline-none focus:ring-2 focus:ring-accent/30 transition"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <SortSelect value={sort} onChange={setSort} />
                <ViewToggle view={view} onChange={setView} />
              </div>

              {/* Empty state — aucun résultat après filtre */}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <p className="text-text-secondary text-sm">Aucun cours ne correspond à cette recherche</p>
                  {search && (
                    <button onClick={() => setSearch('')} className="text-xs text-accent hover:underline flex items-center gap-1">
                      <X size={12} /> Effacer la recherche
                    </button>
                  )}
                </div>
              )}

              {/* Vue liste */}
              {view === 'list' && filtered.length > 0 && (
                <div key={`list-${activeSubject}`} className="view-enter rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                  <ListHeader />
                  {filtered.map((note, i) => (
                    <div key={note.id} className={[
                      'row-enter',
                      `row-${Math.min(i + 1, 10)}`,
                      i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : '',
                    ].join(' ')}>
                      <NoteListRow note={note} />
                    </div>
                  ))}
                </div>
              )}

              {/* Vue cards */}
              {view === 'cards' && filtered.length > 0 && (
                <div key={`cards-${activeSubject}`} className="view-enter grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {filtered.map((note, i) => (
                    <NoteCard key={note.id} note={note} index={i} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
