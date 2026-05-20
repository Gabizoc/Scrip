# Home — Dossiers & Accès Rapide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer la page d'accueil avec une bande de cours récents en scroll horizontal infini, une sidebar de dossiers par matière, et une zone principale avec toggle liste/cards style file-explorer.

**Architecture:** Aucun changement backend. Tout côté client sur les données de `GET /api/notes` déjà disponibles. 4 nouveaux/modifiés fichiers : `noteUtils.js` (utilitaires partagés), `RecentStrip.jsx`, `SubjectSidebar.jsx`, `NoteListRow.jsx`, puis réécriture de `Home.jsx` qui orchestre le tout.

**Tech Stack:** React 18, TanStack Query, React Router, Tailwind CSS, Lucide React, IntersectionObserver API (natif navigateur)

---

## File Structure

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `frontend/src/lib/noteUtils.js` | **Créer** | `parseScore`, `SCORE_COLOR`, `subjectColor`, `SUBJECT_COLORS`, `subjectIcon`, `relativeDate` |
| `frontend/src/components/RecentStrip.jsx` | **Créer** | Bande horizontale scroll infini, charge 8 notes par tranche |
| `frontend/src/components/SubjectSidebar.jsx` | **Créer** | Sidebar matières desktop + chips mobile |
| `frontend/src/components/NoteListRow.jsx` | **Créer** | Une ligne de la vue liste (file-explorer) |
| `frontend/src/components/NoteCard.jsx` | **Modifier** | Supprimer `parseScore` et `subjectColor`/`SUBJECT_COLORS` locaux, importer depuis `noteUtils.js` |
| `frontend/src/pages/Home.jsx` | **Réécrire** | Orchestration des 3 zones, état global |

---

## Task 1 : noteUtils.js — utilitaires partagés

**Files:**
- Create: `frontend/src/lib/noteUtils.js`

- [ ] **Step 1 : Créer le fichier**

```js
// frontend/src/lib/noteUtils.js

/** Parse "98/100" ou 98 → entier, ou null */
export function parseScore(raw) {
  if (raw == null) return null;
  const n = parseInt(String(raw).split('/')[0], 10);
  return isNaN(n) ? null : n;
}

/** Classe Tailwind de couleur selon le score */
export function scoreColor(s) {
  if (s >= 90) return 'text-status-success';
  if (s >= 70) return 'text-status-warning';
  return 'text-status-danger';
}

/** Palette de badges matière (bg + text) */
export const SUBJECT_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
];

/** Classe badge par hash du nom de matière */
export function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

/** Couleur CSS hex du dot matière (pour les pills) */
const DOT_COLORS = ['#7c7aff','#60a5fa','#34d399','#f59e0b','#f472b6','#22d3ee'];
export function subjectDotColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return DOT_COLORS[h % DOT_COLORS.length];
}

/** Emoji déterministe pour une matière */
const SUBJECT_ICONS = ['📜','🌍','🧬','⚖️','🔢','🔬','💬','🎨','🏛️','📐'];
export function subjectIcon(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SUBJECT_ICONS[h % SUBJECT_ICONS.length];
}

/** Date relative en français : "aujourd'hui", "il y a 3j", "il y a 2 sem", "il y a 1 mois" */
export function relativeDate(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days < 7)  return `il y a ${days}j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem`;
  return `il y a ${Math.floor(days / 30)} mois`;
}
```

- [ ] **Step 2 : Vérifier que le fichier est bien en place**

```bash
ls frontend/src/lib/
```
Expected : `api.js  noteUtils.js`

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/lib/noteUtils.js
git commit -m "feat: add noteUtils shared helpers (parseScore, subjectColor, relativeDate…)"
```

---

## Task 2 : Mettre à jour NoteCard pour utiliser noteUtils

**Files:**
- Modify: `frontend/src/components/NoteCard.jsx`

> NoteCard définit actuellement `parseScore`, `SUBJECT_COLORS` et `subjectColor` en local. On les remplace par les imports depuis noteUtils pour éviter la duplication.

- [ ] **Step 1 : Modifier les imports et supprimer les déclarations locales**

Remplacer le début du fichier (lignes 1–36 actuellement) par :

```jsx
// frontend/src/components/NoteCard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import GlassCard from './GlassCard.jsx';
import { api } from '../lib/api.js';
import { parseScore, scoreColor, subjectColor } from '../lib/noteUtils.js';
```

- [ ] **Step 2 : Remplacer `SCORE_COLOR` par `scoreColor`**

Chercher dans le fichier :
```jsx
const SCORE_COLOR = (s) => {
  if (s >= 90) return 'text-status-success';
  if (s >= 70) return 'text-status-warning';
  return 'text-status-danger';
};
```
Supprimer entièrement ce bloc (la fonction vient maintenant de noteUtils).

Chercher aussi :
```jsx
const SUBJECT_COLORS = [
```
et :
```jsx
function subjectColor(name = '') {
```
Supprimer ces deux blocs entiers.

- [ ] **Step 3 : Mettre à jour l'unique usage de SCORE_COLOR dans le JSX**

Trouver :
```jsx
className={`text-xs font-semibold font-mono ${SCORE_COLOR(score)}`}
```
Remplacer par :
```jsx
className={`text-xs font-semibold font-mono ${scoreColor(score)}`}
```

- [ ] **Step 4 : Vérifier que l'app compile sans erreur**

```bash
cd frontend && npm run dev
```
Expected : serveur Vite démarre sans erreur de compilation. Ouvrir http://localhost:5173, les NoteCards s'affichent correctement avec les badges colorés.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components/NoteCard.jsx
git commit -m "refactor: NoteCard uses shared noteUtils (no more local parseScore/subjectColor)"
```

---

## Task 3 : RecentStrip — scroll horizontal infini

**Files:**
- Create: `frontend/src/components/RecentStrip.jsx`

- [ ] **Step 1 : Créer le composant**

```jsx
// frontend/src/components/RecentStrip.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseScore, scoreColor, subjectDotColor, relativeDate } from '../lib/noteUtils.js';

const CHUNK = 8;

function RecentPill({ note }) {
  const navigate = useNavigate();
  const score = parseScore(note.metadata?.qualite_francais);
  const dot   = subjectDotColor(note.subject ?? '');

  return (
    <button
      onClick={() => navigate(`/preview/${note.id}`)}
      className={[
        'flex-shrink-0 w-[130px] text-left',
        'bg-white/[0.05] dark:bg-white/[0.04]',
        'border border-white/[0.07]',
        'rounded-xl px-3 py-2.5 transition-all duration-150',
        'hover:bg-white/[0.09] hover:-translate-y-0.5',
        'active:scale-95',
      ].join(' ')}
    >
      <p className="text-[11px] font-semibold text-text-primary truncate mb-1.5 leading-tight">
        {note.title}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className="w-[6px] h-[6px] rounded-full flex-shrink-0"
          style={{ background: dot }}
        />
        <span className="text-[9px] text-text-tertiary truncate flex-1">
          {note.subject ?? '—'}
        </span>
        {score != null && (
          <span className={`text-[9px] font-bold font-mono flex-shrink-0 ${scoreColor(score)}`}>
            {score}
          </span>
        )}
      </div>
    </button>
  );
}

export default function RecentStrip({ notes }) {
  const scrollRef   = useRef(null);
  const sentinelRef = useRef(null);
  const [visible, setVisible] = useState(CHUNK);

  const sorted = useMemo(
    () => [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [notes],
  );

  const displayed = sorted.slice(0, visible);
  const hasMore   = visible < sorted.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root     = scrollRef.current;
    if (!sentinel || !root || !hasMore) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(v => Math.min(v + CHUNK, sorted.length));
        }
      },
      { root, threshold: 0.1 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, sorted.length]);

  if (!notes.length) return null;

  return (
    <div className="mb-6">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2.5">
        ⚡ Récemment ajoutés
      </p>
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayed.map(note => <RecentPill key={note.id} note={note} />)}
        {hasMore && (
          <div ref={sentinelRef} className="w-1 flex-shrink-0 self-stretch" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Tester visuellement**

Dans un composant temporaire (ou directement dans Home), importer et rendre `<RecentStrip notes={notes} />`. Vérifier que :
- Les 8 premières pills s'affichent
- En scrollant à droite, 8 nouvelles se chargent
- Cliquer une pill navigue vers `/preview/:id`

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/components/RecentStrip.jsx
git commit -m "feat: RecentStrip horizontal infinite scroll (8 per chunk, IntersectionObserver)"
```

---

## Task 4 : SubjectSidebar — dossiers desktop + chips mobile

**Files:**
- Create: `frontend/src/components/SubjectSidebar.jsx`

- [ ] **Step 1 : Créer le composant**

```jsx
// frontend/src/components/SubjectSidebar.jsx
import { subjectIcon } from '../lib/noteUtils.js';

// ── Item sidebar desktop ──────────────────────────────────────────────────────
function SidebarItem({ icon, name, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
        active
          ? 'bg-accent/[0.18] text-accent'
          : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary',
      ].join(' ')}
    >
      <span className="text-base flex-shrink-0 leading-none">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-semibold truncate">{name}</span>
        <span className="block text-[9px] opacity-60 font-normal">{count} cours</span>
      </span>
      {active && (
        <span className="flex-shrink-0 text-[9px] font-bold bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

// ── Chip mobile ───────────────────────────────────────────────────────────────
function MobileChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150',
        active
          ? 'bg-accent text-white shadow-sm'
          : 'bg-black/[0.05] dark:bg-white/[0.07] text-text-secondary hover:bg-black/[0.09] dark:hover:bg-white/[0.12]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function SubjectSidebar({ subjects, activeSubject, onSelect, totalCount }) {
  return (
    <>
      {/* ── Desktop : colonne fixe 130px ── */}
      <aside className="hidden md:flex flex-col w-[130px] shrink-0 gap-0.5 pt-0.5">
        <SidebarItem
          icon="🗂️"
          name="Tous"
          count={totalCount}
          active={activeSubject === null}
          onClick={() => onSelect(null)}
        />
        <div className="h-px bg-white/[0.05] my-1.5 mx-1" />
        {subjects.map(([name, count]) => (
          <SidebarItem
            key={name}
            icon={subjectIcon(name)}
            name={name}
            count={count}
            active={activeSubject === name}
            onClick={() => onSelect(activeSubject === name ? null : name)}
          />
        ))}
      </aside>

      {/* ── Mobile : chips scrollables ── */}
      <div
        className="md:hidden flex gap-2 overflow-x-auto mb-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <MobileChip active={activeSubject === null} onClick={() => onSelect(null)}>
          Tous
        </MobileChip>
        {subjects.map(([name]) => (
          <MobileChip
            key={name}
            active={activeSubject === name}
            onClick={() => onSelect(activeSubject === name ? null : name)}
          >
            {subjectIcon(name)} {name}
          </MobileChip>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add frontend/src/components/SubjectSidebar.jsx
git commit -m "feat: SubjectSidebar with desktop column and mobile chips"
```

---

## Task 5 : NoteListRow — ligne vue liste (file explorer)

**Files:**
- Create: `frontend/src/components/NoteListRow.jsx`

- [ ] **Step 1 : Créer le composant**

```jsx
// frontend/src/components/NoteListRow.jsx
import { useNavigate } from 'react-router-dom';
import { parseScore, scoreColor, subjectColor, relativeDate } from '../lib/noteUtils.js';

export default function NoteListRow({ note }) {
  const navigate = useNavigate();
  const score    = parseScore(note.metadata?.qualite_francais);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/preview/${note.id}`)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/preview/${note.id}`); }}
      aria-label={`Ouvrir le cours : ${note.title}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 hover:bg-white/[0.04] active:bg-white/[0.07] group"
    >
      {/* Icône */}
      <span className="text-sm flex-shrink-0 text-text-tertiary group-hover:text-text-secondary transition-colors">
        📄
      </span>

      {/* Titre */}
      <span className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">
        {note.title}
      </span>

      {/* Matière (masquée sur mobile) */}
      {note.subject && (
        <span
          className={[
            'hidden md:inline-flex shrink-0',
            'items-center text-[10px] font-semibold px-2 py-0.5 rounded-full',
            'w-[88px] justify-center truncate',
            subjectColor(note.subject),
          ].join(' ')}
        >
          {note.subject}
        </span>
      )}

      {/* Date (masquée sur mobile) */}
      <span className="hidden md:block shrink-0 w-[64px] text-right text-xs text-text-tertiary">
        {relativeDate(note.createdAt)}
      </span>

      {/* Score */}
      <span className="shrink-0 w-[52px] text-right">
        {score != null ? (
          <span className={`text-xs font-semibold font-mono ${scoreColor(score)}`}>
            {score}/100
          </span>
        ) : null}
      </span>
    </div>
  );
}
```

- [ ] **Step 2 : Commit**

```bash
git add frontend/src/components/NoteListRow.jsx
git commit -m "feat: NoteListRow file-explorer style (title, subject badge, date, score)"
```

---

## Task 6 : Home.jsx — réécriture complète

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

- [ ] **Step 1 : Réécrire entièrement Home.jsx**

```jsx
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
  const btn = (v, Icon) => (
    <button
      onClick={() => onChange(v)}
      className={[
        'p-1.5 rounded-md transition-all duration-150',
        view === v
          ? 'bg-accent/20 text-accent'
          : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.05]',
      ].join(' ')}
      aria-label={v === 'list' ? 'Vue liste' : 'Vue cards'}
    >
      <Icon size={15} />
    </button>
  );
  return (
    <div className="flex gap-0.5">
      {btn('list', List)}
      {btn('cards', LayoutGrid)}
    </div>
  );
}

// ── ListHeader (colonnes) ─────────────────────────────────────────────────────

function ListHeader() {
  return (
    <div className="hidden md:flex items-center gap-3 px-3 pb-2 mb-1 border-b border-white/[0.05] text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
      <span className="w-[18px] flex-shrink-0" /> {/* icône placeholder */}
      <span className="flex-1">Titre</span>
      <span className="w-[88px] text-center">Matière</span>
      <span className="w-[64px] text-right">Date</span>
      <span className="w-[52px] text-right">Score</span>
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

  const folderTitle = activeSubject ?? 'Tous les cours';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">

      {/* ── Bande récents ── */}
      {!isLoading && notes.length > 0 && (
        <RecentStrip notes={notes} />
      )}

      {/* ── Body : sidebar + contenu ── */}
      <div className="flex gap-5 items-start">

        {/* Sidebar matières */}
        {!isLoading && notes.length > 0 && (
          <SubjectSidebar
            subjects={subjects}
            activeSubject={activeSubject}
            onSelect={setActiveSubject}
            totalCount={notes.length}
          />
        )}

        {/* Zone principale */}
        <div className="flex-1 min-w-0">

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
          {!isLoading && notes.length > 0 && (
            <>
              {/* Header : titre + chips mobile matières + recherche + tri + toggle */}
              <SubjectSidebar
                subjects={subjects}
                activeSubject={activeSubject}
                onSelect={setActiveSubject}
                totalCount={notes.length}
              />

              <div className="flex items-center gap-2 flex-wrap mb-4">
                <h2 className="text-sm font-semibold text-text-primary flex-shrink-0">
                  {folderTitle}
                  <span className="ml-1.5 text-text-tertiary font-normal text-xs">{filtered.length}</span>
                </h2>

                {/* Recherche */}
                <div className="relative flex-1 min-w-[140px] max-w-xs">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
                  <input
                    type="search"
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

              {/* Empty state — aucun résultat */}
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
                <div>
                  <ListHeader />
                  {filtered.map(note => (
                    <NoteListRow key={note.id} note={note} />
                  ))}
                </div>
              )}

              {/* Vue cards */}
              {view === 'cards' && filtered.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
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
```

> ⚠️ **Note :** Le composant `SubjectSidebar` est rendu deux fois dans le JSX — une fois pour la sidebar desktop (il se masque tout seul via `hidden md:flex`), et une fois pour les chips mobile (il se masque via `md:hidden`). C'est le même composant, mais les deux instances sont dans des contextes DOM différents (avant et dans le header). Cela permet de garder le layout propre sans CSS complexe.

**Correction** — en fait le double rendu est inutile : `SubjectSidebar` gère déjà les deux contextes dans un seul rendu (`<aside className="hidden md:flex ...">` + `<div className="md:hidden ...">`). Il faut le rendre **une seule fois**, avant le header. Voici la structure corrigée du return de Home :

```jsx
return (
  <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">

    {/* Bande récents */}
    {!isLoading && notes.length > 0 && <RecentStrip notes={notes} />}

    {/* Body */}
    <div className="flex gap-5 items-start">

      {/* Sidebar desktop (se masque seule sur mobile via hidden md:flex) */}
      {!isLoading && notes.length > 0 && (
        <SubjectSidebar
          subjects={subjects}
          activeSubject={activeSubject}
          onSelect={setActiveSubject}
          totalCount={notes.length}
        />
      )}

      {/* Zone principale */}
      <div className="flex-1 min-w-0">
        {isLoading && ( /* skeleton */ )}
        {!isLoading && notes.length === 0 && ( /* empty state */ )}
        {!isLoading && notes.length > 0 && (
          <>
            {/* Chips mobile (se masquent seules sur desktop via md:hidden) */}
            {/* Déjà inclus dans SubjectSidebar — rien à ajouter ici */}

            {/* Header : titre + recherche + tri + toggle */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {/* ... comme ci-dessus ... */}
            </div>

            {/* Vue liste / cards */}
          </>
        )}
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2 : Vérifier en navigateur**

Ouvrir http://localhost:5173 et vérifier :
- La bande récents s'affiche en haut avec les pills scrollables
- La sidebar est visible sur desktop (largeur > 768px), remplacée par des chips sur mobile
- Le toggle ☰/⊞ fonctionne et la préférence survit à un refresh (localStorage)
- La recherche filtre les notes en temps réel
- Cliquer un dossier dans la sidebar filtre les notes et la recherche se vide

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "feat: Home rewrite — sidebar folders, recent strip, list/cards toggle"
```

---

## Task 7 : Nettoyage final

**Files:**
- Vérifier qu'aucun import orphelin ne subsiste

- [ ] **Step 1 : Vérifier les imports inutilisés dans Home.jsx**

Les imports `SlidersHorizontal` et `Camera` doivent rester (Camera pour l'empty state). `SlidersHorizontal` est supprimé car `FilterBar` est supprimé. Vérifier que la liste d'imports de `Home.jsx` ne contient que :

```jsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, Search, X, ChevronDown, List, LayoutGrid } from 'lucide-react';
import { api } from '../lib/api.js';
import { parseScore } from '../lib/noteUtils.js';
import NoteCard from '../components/NoteCard.jsx';
import NoteListRow from '../components/NoteListRow.jsx';
import RecentStrip from '../components/RecentStrip.jsx';
import SubjectSidebar from '../components/SubjectSidebar.jsx';
```

- [ ] **Step 2 : Vérifier que la console navigateur n'a aucune warning React**

- [ ] **Step 3 : Commit final**

```bash
git add -A
git commit -m "chore: cleanup unused imports after Home restructure"
```

---

## Résumé des fichiers

| Fichier | Statut final |
|---------|-------------|
| `frontend/src/lib/noteUtils.js` | ✅ Créé |
| `frontend/src/components/RecentStrip.jsx` | ✅ Créé |
| `frontend/src/components/SubjectSidebar.jsx` | ✅ Créé |
| `frontend/src/components/NoteListRow.jsx` | ✅ Créé |
| `frontend/src/components/NoteCard.jsx` | ✅ Mis à jour |
| `frontend/src/pages/Home.jsx` | ✅ Réécrit |
