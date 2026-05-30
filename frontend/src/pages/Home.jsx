import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, Search, X, List, LayoutGrid, Folder, FolderOpen, ChevronRight, ArrowLeft, Plus } from 'lucide-react';
import Dropdown from '../components/Dropdown.jsx';
import { api } from '../lib/api.js';
import { parseScore } from '../lib/noteUtils.js';
import NoteCard from '../components/NoteCard.jsx';
import NoteListRow from '../components/NoteListRow.jsx';
import RecentStrip from '../components/RecentStrip.jsx';
import SubjectSidebar from '../components/SubjectSidebar.jsx';
import ErrorState from '../components/ErrorState.jsx';
import CreateNoteSheet from '../components/CreateNoteSheet.jsx';

const SORT_OPTIONS = [
  { value: 'date-desc',  label: 'Plus récent' },
  { value: 'date-asc',   label: 'Plus ancien' },
  { value: 'score-desc', label: 'Meilleur score' },
  { value: 'title-asc',  label: 'A → Z' },
];

function SortDropdown({ value, onChange }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={SORT_OPTIONS}
      className="flex-shrink-0 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium
        bg-black/[0.05] dark:bg-white/[0.07] text-text-secondary
        hover:bg-black/[0.09] dark:hover:bg-white/[0.12]"
    />
  );
}

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

function FolderRow({ name, count, index, onClick }) {
  return (
    <div className={['row-enter', `row-${Math.min(index + 1, 10)}`].join(' ')}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        className="group relative flex items-center gap-3 px-4 py-2.5 cursor-pointer
          transition-colors duration-300 ease-out
          hover:bg-black/[0.025] dark:hover:bg-white/[0.035]
          bg-white dark:bg-neutral-950"
      >
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full
          bg-accent opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

        <Folder size={13} className="flex-shrink-0 ml-1 text-accent opacity-70 group-hover:opacity-100 transition-opacity" />

        <span className="flex-1 min-w-0 text-[13px] font-medium text-text-primary truncate">
          {name}
        </span>

        <span className="hidden md:block shrink-0 w-[80px] text-right text-[11px] text-text-tertiary tabular-nums">
          {count} cours
        </span>

        <span className="shrink-0 w-[44px] flex justify-end">
          <ChevronRight size={13} className="text-text-tertiary group-hover:text-accent transition-colors" />
        </span>

        <span className="shrink-0 w-[28px]" />
      </div>
    </div>
  );
}

function FolderBreadcrumb({ folder, onBack }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5
      bg-accent/[0.06] dark:bg-accent/[0.08]
      border-b border-accent/[0.12]">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-accent
          hover:text-accent/70 transition-colors font-medium"
      >
        <ArrowLeft size={13} />
        Retour
      </button>
      <span className="text-text-tertiary text-[11px]">/</span>
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-text-primary">
        <FolderOpen size={13} className="text-accent" />
        {folder}
      </span>
    </div>
  );
}

function FileManagerView({ notes, ftResults }) {
  const [openFolder, setOpenFolder] = useState(null);

  useEffect(() => { setOpenFolder(null); }, [notes]);

  if (ftResults !== null) {
    return ftResults.map((note, i) => (
      <div key={note.id} className={[
        'row-enter', `row-${Math.min(i + 1, 10)}`,
        i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : '',
      ].join(' ')}>
        <NoteListRow note={note} snippet={note.snippet ?? null} />
      </div>
    ));
  }

  const folderMap = new Map();
  const unfiled   = [];
  for (const note of notes) {
    if (note.subfolder) {
      if (!folderMap.has(note.subfolder)) folderMap.set(note.subfolder, []);
      folderMap.get(note.subfolder).push(note);
    } else {
      unfiled.push(note);
    }
  }
  const folders = [...folderMap.keys()].sort((a, b) => a.localeCompare(b, 'fr'));
  const hasFolders = folders.length > 0;

  if (openFolder !== null) {
    const folderNotes = folderMap.get(openFolder) ?? [];
    return (
      <>
        <FolderBreadcrumb folder={openFolder} onBack={() => setOpenFolder(null)} />
        {folderNotes.map((note, i) => (
          <div key={note.id} className={[
            'row-enter', `row-${Math.min(i + 1, 10)}`,
            i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : '',
          ].join(' ')}>
            <NoteListRow note={note} snippet={null} hideSubfolder />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {folders.map((folder, i) => (
        <FolderRow
          key={folder}
          name={folder}
          count={folderMap.get(folder).length}
          index={i}
          onClick={() => setOpenFolder(folder)}
        />
      ))}

      {hasFolders && unfiled.length > 0 && (
        <div className="border-t border-black/[0.05] dark:border-white/[0.06]" />
      )}

      {unfiled.map((note, i) => (
        <div key={note.id} className={[
          'row-enter', `row-${Math.min(folders.length + i + 1, 10)}`,
          (hasFolders || i > 0) ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : '',
        ].join(' ')}>
          <NoteListRow note={note} snippet={null} />
        </div>
      ))}
    </>
  );
}

export default function Home() {
  const { data: notes = [], isLoading, error: notesError } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getNotes,
  });

  const { data: subjectsList = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.getSubjects(),
  });

  const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState(null);
  const [showCreate, setShowCreate]       = useState(false);
  const [search, setSearch]               = useState('');
  const [sort, setSort]                   = useState('date-desc');
  const [view, setView]                   = useState(
    () => localStorage.getItem('scrip-home-view') ?? 'list',
  );

  const [ftResults, setFtResults]   = useState(null);
  const [ftLoading, setFtLoading]   = useState(false);
  const ftDebounceRef               = useRef(null);

  useEffect(() => {
    localStorage.setItem('scrip-home-view', view);
  }, [view]);

  useEffect(() => { setSearch(''); }, [activeSubject]);

  useEffect(() => {
    if (ftDebounceRef.current) clearTimeout(ftDebounceRef.current);
    if (search.trim().length < 3) {
      setFtResults(null);
      setFtLoading(false);
      return;
    }
    setFtLoading(true);
    ftDebounceRef.current = setTimeout(async () => {
      try {
        const results = await api.searchNotes(search.trim());
        const filtered = activeSubject
          ? results.filter(n => n.subject === activeSubject)
          : results;
        setFtResults(filtered);
      } catch {
        setFtResults([]);
      } finally {
        setFtLoading(false);
      }
    }, 400);
    return () => clearTimeout(ftDebounceRef.current);
  }, [search, activeSubject]);

  const emojiMap = useMemo(() => {
    const m = new Map();
    for (const s of subjectsList) if (s.emoji) m.set(s.name, s.emoji);
    return m;
  }, [subjectsList]);

  const subjects = useMemo(() => {
    const map = new Map();
    for (const n of notes) {
      if (n.subject) map.set(n.subject, (map.get(n.subject) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => [name, count, emojiMap.get(name) ?? null]);
  }, [notes, emojiMap]);

  const filtered = useMemo(() => {
    if (ftResults !== null) return ftResults;

    const q = search.toLowerCase().trim();
    const result = notes.filter(n => {
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
  }, [notes, search, activeSubject, sort, ftResults]);

  const folderTitle  = activeSubject ?? 'Tous les cours';
  const hasNotes    = !isLoading && notes.length > 0;

  return (
    <>
    <div className="flex flex-col h-screen px-3 pt-3 pb-0 sm:px-5 sm:pt-5 lg:px-8 lg:pt-6 max-w-screen-2xl mx-auto" style={{ overflow: 'clip' }}>

      {hasNotes && (
        <div className="flex-shrink-0">
          <RecentStrip notes={notes} />
        </div>
      )}

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

      <div className="flex gap-5 flex-1 min-h-0">

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

        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-visible pt-2 px-3 pb-6 -mx-3">

          {notesError && !isLoading && (
            <ErrorState message="Impossible de charger les cours." />
          )}

          {isLoading && (
            <div className="animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-28 rounded-full bg-black/[0.06] dark:bg-white/[0.06]" />
                <div className="flex-1 h-7 rounded-full bg-black/[0.05] dark:bg-white/[0.05]" />
                <div className="h-7 w-24 rounded-full bg-black/[0.05] dark:bg-white/[0.05]" />
                <div className="h-7 w-14 rounded-full bg-black/[0.05] dark:bg-white/[0.05]" />
              </div>

              <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.07] overflow-hidden">
                <div className="hidden md:flex items-center gap-3 px-4 py-2.5 border-b border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="w-[7px] ml-1" />
                  <div className="flex-1 h-2 w-8 rounded bg-black/[0.08] dark:bg-white/[0.08]" />
                  <div className="w-[90px] h-2 rounded bg-black/[0.08] dark:bg-white/[0.08]" />
                  <div className="w-[80px] h-2 rounded bg-black/[0.08] dark:bg-white/[0.08]" />
                  <div className="w-[44px] h-2 rounded bg-black/[0.08] dark:bg-white/[0.08]" />
                  <div className="w-[28px]" />
                </div>

                {[1, 0.85, 0.7, 0.55, 0.4, 0.25, 0.12].map((opacity, i) => (
                  <div
                    key={i}
                    style={{ opacity }}
                    className={`flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-neutral-950 ${i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : ''}`}
                  >
                    <div className="w-[7px] h-[7px] rounded-full ml-1 bg-black/[0.10] dark:bg-white/[0.12] shrink-0" />
                    <div className="flex-1">
                      <div
                        className="h-3 rounded-full bg-black/[0.07] dark:bg-white/[0.09]"
                        style={{ width: `${48 + ((i * 43) % 38)}%` }}
                      />
                    </div>
                    <div className="hidden md:block w-[90px]">
                      <div className="h-4 rounded-md bg-black/[0.06] dark:bg-white/[0.07] mx-auto w-14" />
                    </div>
                    <div className="hidden md:block w-[80px]">
                      <div className="h-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.06] ml-auto w-16" />
                    </div>
                    <div className="w-[44px] flex justify-end">
                      <div className="h-3 w-6 rounded-full bg-black/[0.07] dark:bg-white/[0.09]" />
                    </div>
                    <div className="w-[28px] h-6 rounded-md bg-black/[0.04] dark:bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !notesError && notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Camera size={28} className="text-accent" strokeWidth={1.5} />
              </div>
              <p className="text-text-primary font-medium mb-1">Aucun cours</p>
              <p className="text-text-secondary text-sm mb-4">Capture ta première photo pour commencer</p>
              <div className="flex flex-col items-center gap-2.5">
                <button
                  onClick={() => navigate('/capture')}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-medium
                    bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  <Camera size={14} />
                  Scanner
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-medium
                    text-text-secondary hover:text-text-primary
                    hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                >
                  <Plus size={14} />
                  Créer manuellement
                </button>
              </div>
            </div>
          )}

          {hasNotes && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-text-primary flex-shrink-0">
                  {ftResults !== null ? 'Résultats' : folderTitle}
                  <span className="ml-0.5 text-text-tertiary font-normal text-xs">{filtered.length}</span>
                  {ftResults !== null && (
                    <span className="text-[10px] text-accent font-normal bg-accent/10 px-1.5 py-0.5 rounded-full">
                      contenu
                    </span>
                  )}
                </h2>

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
                  {ftLoading && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin pointer-events-none" />
                  )}
                  {search && !ftLoading && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <SortDropdown value={sort} onChange={setSort} />
                <ViewToggle view={view} onChange={setView} />

                <button
                  onClick={() => setShowCreate(true)}
                  title="Créer un cours"
                  aria-label="Créer un cours"
                  className="flex-shrink-0 flex items-center gap-1 pl-2 pr-2.5 h-7 rounded-full text-[12px] font-medium
                    bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  <Plus size={13} />
                  <span className="hidden sm:inline">Nouveau</span>
                </button>
              </div>

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

              {view === 'list' && filtered.length > 0 && (
                <div key={`list-${activeSubject}`} className="view-enter rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                  <ListHeader />
                  <FileManagerView notes={filtered} ftResults={ftResults} />
                </div>
              )}

              {view === 'cards' && filtered.length > 0 && (
                <div key={`cards-${activeSubject}`} className="view-enter grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 pt-2">
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

      {showCreate && <CreateNoteSheet onClose={() => setShowCreate(false)} />}
    </>
  );
}
