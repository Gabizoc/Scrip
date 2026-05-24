# Swipe Delete · Move Notes · Auto-Summary · Full-Text Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four UX features to Scrip: swipe-to-delete on mobile, move notes between subjects/subfolders, auto-generated summaries during ingest, and full-text search across note content.

**Architecture:** Backend gains a `summarize.js` pipeline module (called during ingest), an extended `PATCH /notes/:id` (now accepts `subjectId` + `subfolder`), and a new `GET /notes/search?q=` endpoint that reads markdown files from disk. Frontend gains a `MoveNoteSheet` portal component, swipe gestures in `NoteListRow`, a three-dot menu in both list and card views, resume display on cards, and a debounced full-text search in `Home.jsx`.

**Tech Stack:** Node.js ESM, Express, LowDB, React 18, TanStack Query, Tailwind CSS, `createPortal`

---

## File Map

| File | Change |
|---|---|
| `backend/src/pipeline/summarize.js` | **CREATE** — LLM summary via OpenRouter |
| `backend/src/routes/ingest.js` | **MODIFY** — call summarize + emit SSE step |
| `backend/src/routes/notes.js` | **MODIFY** — extend PATCH + add GET /search |
| `frontend/src/lib/api.js` | **MODIFY** — add `searchNotes` |
| `frontend/src/components/MoveNoteSheet.jsx` | **CREATE** — bottom-sheet portal for moving a note |
| `frontend/src/components/NoteListRow.jsx` | **MODIFY** — swipe delete + ⋯ menu + snippet prop |
| `frontend/src/components/NoteCard.jsx` | **MODIFY** — ⋯ menu + `metadata.resume` display |
| `frontend/src/pages/Home.jsx` | **MODIFY** — full-text search via backend |

---

## Task 1 — `summarize.js` pipeline module

**Files:**
- Create: `backend/src/pipeline/summarize.js`

- [ ] **Step 1: Create the file**

```js
// backend/src/pipeline/summarize.js
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemma-4-26b-a4b-it:free';

/**
 * Génère un résumé de 2-3 phrases à partir du markdown d'une note.
 * Retourne une string ou null si l'appel échoue / le résultat est invalide.
 *
 * @param {string} markdown  — contenu complet de la note (avec YAML frontmatter)
 * @param {string} level     — niveau scolaire ex: "1ère"
 * @param {string} apiKey    — clé OpenRouter
 * @returns {Promise<string|null>}
 */
export async function summarizeNote(markdown, level, apiKey) {
  if (!apiKey) return null;

  // Retire le frontmatter YAML
  const content = markdown.replace(/^---[\s\S]*?---\s*\n/, '').trim();
  if (content.length < 80) return null;

  const userPrompt =
    `Tu es un assistant pour lycéens français (niveau ${level}).\n` +
    `Résume ce cours en 2 à 3 phrases claires et concises en français.\n` +
    `Ne commence pas par "Ce cours" ou "Le cours". Réponds uniquement avec le résumé.\n\n` +
    content.slice(0, 3000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://scrip.local',
        'X-Title': 'Scrip',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    return text.length > 15 ? text : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls backend/src/pipeline/summarize.js
```
Expected: file listed, no error.

- [ ] **Step 3: Commit**

```bash
git add backend/src/pipeline/summarize.js
git commit -m "feat: add summarizeNote pipeline module"
```

---

## Task 2 — Integrate summary into ingest pipeline

**Files:**
- Modify: `backend/src/routes/ingest.js`

The summary step runs **after** `format` and **before** `save`. It calls `summarizeNote` with the built note markdown, stores the result in `metadata.resume`, and emits a `summary` SSE step. A failure is silent (null resume, step marked done with detail "ignoré").

- [ ] **Step 1: Add the import at the top of ingest.js** (after the existing imports block)

Find this line:
```js
import { createJob, getJob, emitStep, emitDone, emitError, emitWarning } from '../jobs.js';
```
Add immediately after:
```js
import { summarizeNote } from '../pipeline/summarize.js';
```

- [ ] **Step 2: Locate the format step completion in `runPipeline`**

Find this exact block (around line 168 in the original file):
```js
  const lineCount = contentForFile.split('\n').filter(l => l.trim()).length;
  step('format', 'Mise en forme', 'done', `${lineCount} lignes`);

  // 4. Sauvegarde
  step('save', 'Sauvegarde de la note', 'running');
```

- [ ] **Step 3: Insert the summary step between format-done and save**

Replace that block with:
```js
  const lineCount = contentForFile.split('\n').filter(l => l.trim()).length;
  step('format', 'Mise en forme', 'done', `${lineCount} lignes`);

  // 4.5 Résumé automatique
  step('summary', 'Résumé automatique', 'running');
  let resume = null;
  try {
    resume = await summarizeNote(note, level.name, openrouterKey);
  } catch { /* non-bloquant */ }
  step('summary', 'Résumé automatique', 'done', resume ? undefined : 'ignoré');

  // 4. Sauvegarde
  step('save', 'Sauvegarde de la note', 'running');
```

- [ ] **Step 4: Store `resume` in `metadata` before the noteRecord is built**

Find this line in `runPipeline`:
```js
  const subfolderId = subfolderSegments.length > 0 ? subfolderSegments.join('/') : null;
```
Replace it with:
```js
  // Ajoute le résumé aux métadonnées si disponible
  if (resume) metadata.resume = resume;

  const subfolderId = subfolderSegments.length > 0 ? subfolderSegments.join('/') : null;
```

- [ ] **Step 5: Restart the backend and do a test ingest**

```bash
cd backend && node src/index.js
```
After ingest, check that the SSE stream includes `{"id":"summary","label":"Résumé automatique","status":"done"}`.
Also check `db.json` → the note's `metadata` object should contain a `resume` string.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/ingest.js
git commit -m "feat: generate auto-summary during ingest, store in metadata.resume"
```

---

## Task 3 — Extend `PATCH /notes/:id` + add `GET /notes/search`

**Files:**
- Modify: `backend/src/routes/notes.js`

### 3a — Extend PATCH to accept `subjectId` and `subfolder`

- [ ] **Step 1: Replace the PATCH handler destructuring and guard**

Find:
```js
notesRouter.patch('/:id', async (req, res) => {
  const { markdown, subject, title } = req.body;
  if (markdown === undefined && subject === undefined && title === undefined) {
    return res.status(400).json({ error: 'markdown, subject ou title requis' });
  }
```
Replace with:
```js
notesRouter.patch('/:id', async (req, res) => {
  const { markdown, subject, title, subjectId, subfolder } = req.body;
  if (
    markdown === undefined && subject === undefined && title === undefined &&
    subjectId === undefined && subfolder === undefined
  ) {
    return res.status(400).json({ error: 'markdown, subject, title, subjectId ou subfolder requis' });
  }
```

- [ ] **Step 2: Add handling for `subjectId` and `subfolder` before `note.updatedAt`**

Find:
```js
  note.updatedAt = new Date().toISOString();
  await db.write();
```
Insert before that line:
```js
  // Mise à jour de la matière par ID direct
  if (typeof subjectId === 'string' && subjectId.trim().length > 0) {
    const sub = db.data.subjects.find(s => s.id === subjectId);
    if (!sub) return res.status(400).json({ error: 'matière introuvable' });
    note.subjectId = sub.id;
  }

  // Mise à jour du sous-dossier (chaîne vide = suppression)
  if (subfolder !== undefined) {
    const sf = String(subfolder).trim();
    if (sf) {
      note.subfolder = sf;
    } else {
      delete note.subfolder;
    }
  }
```

### 3b — Add full-text search endpoint

The `GET /notes/search` route **must** be registered **before** `GET /:id` so Express doesn't match "search" as an ID.

- [ ] **Step 3: Add the search route between `GET /` and `GET /:id`**

Find this line:
```js
notesRouter.get('/:id', async (req, res) => {
```
Insert the entire search route immediately **before** it:
```js
// GET /notes/search?q=xxx — recherche full-text dans les titres et le contenu markdown
notesRouter.get('/search', async (req, res) => {
  const q = (req.query.q ?? '').toLowerCase().trim();
  if (q.length < 2) return res.json([]);

  await db.read();
  const results = [];

  for (const note of db.data.notes) {
    const subject = db.data.subjects.find(s => s.id === note.subjectId);
    const level   = db.data.levels.find(l => l.id === note.levelId);
    const enriched = {
      ...note,
      subject: subject?.name ?? note.subjectId,
      level:   level?.name   ?? note.levelId,
    };

    // Cherche d'abord dans le titre (pas besoin de lire le fichier)
    if (note.title?.toLowerCase().includes(q)) {
      results.push({ ...enriched, snippet: null });
      continue;
    }

    // Cherche dans le contenu markdown
    if (!note.path || !fs.existsSync(note.path)) continue;
    let raw;
    try { raw = fs.readFileSync(note.path, 'utf8'); } catch { continue; }

    const lower = raw.toLowerCase();
    const idx   = lower.indexOf(q);
    if (idx === -1) continue;

    // Extrait un extrait de 90 chars centré sur le match
    const start   = Math.max(0, idx - 40);
    const end     = Math.min(raw.length, idx + q.length + 50);
    const snippet =
      (start > 0 ? '…' : '') +
      raw.slice(start, end).replace(/[#*`\n]/g, ' ').replace(/\s+/g, ' ').trim() +
      (end < raw.length ? '…' : '');

    results.push({ ...enriched, snippet });
  }

  // Tri : titres en premier, puis contenu ; max 50 résultats
  results.sort((a, b) => (a.snippet === null ? -1 : b.snippet === null ? 1 : 0));
  res.json(results.slice(0, 50));
});

```

- [ ] **Step 4: Test the search endpoint manually**

```bash
curl "http://localhost:3001/api/notes/search?q=revolution"
```
Expected: JSON array of notes, each with `snippet` string or `null`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/notes.js
git commit -m "feat: extend PATCH /notes/:id with subjectId+subfolder, add GET /notes/search"
```

---

## Task 4 — `api.js` — add `searchNotes`

**Files:**
- Modify: `frontend/src/lib/api.js`

The `patchNoteMeta` function already handles `{ subjectId, subfolder }` since it sends any object to `PATCH /notes/:id`. Only `searchNotes` is new.

- [ ] **Step 1: Read the current api.js to find the right insertion point**

Open `frontend/src/lib/api.js`. Find the notes section — it ends around:
```js
  deleteNote:      (id)       => request('DELETE', `/notes/${id}`),
  getNoteSources:  (id)       => request('GET',    `/notes/${id}/sources`),
```

- [ ] **Step 2: Add `searchNotes` after `getNoteSources`**

```js
  searchNotes:     (q)        => request('GET',    `/notes/search?q=${encodeURIComponent(q)}`),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.js
git commit -m "feat: add searchNotes to api client"
```

---

## Task 5 — `MoveNoteSheet` component

**Files:**
- Create: `frontend/src/components/MoveNoteSheet.jsx`

A bottom-sheet portal that lets the user pick a new subject and/or subfolder for a note. Uses `createPortal`, `position: fixed`, React Query for subjects + folder autocomplete.

- [ ] **Step 1: Create the file**

```jsx
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

  // Trouve la matière courante de la note
  const currentSubject = subjects.find(s => s.id === note.subjectId);

  const [subjectId, setSubjectId] = useState(note.subjectId ?? '');
  const [subfolder, setSubfolder] = useState(note.subfolder ?? '');

  // Sous-dossiers existants pour la matière sélectionnée
  const selectedSubject = subjects.find(s => s.id === subjectId);
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
    // Petit délai pour éviter que le clic d'ouverture ferme immédiatement
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

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[9999]
          bg-white dark:bg-neutral-900
          rounded-t-2xl shadow-2xl
          border-t border-black/[0.08] dark:border-white/[0.08]
          p-5 space-y-4
          animate-slide-up"
        style={{ maxWidth: 520, margin: '0 auto' }}
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
```

- [ ] **Step 2: Add the `animate-slide-up` keyframe to `frontend/src/app.css`** (or wherever global animations live)

Find the end of `frontend/src/app.css` and add:
```css
@keyframes slide-up {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.animate-slide-up {
  animation: slide-up 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MoveNoteSheet.jsx frontend/src/app.css
git commit -m "feat: add MoveNoteSheet bottom-sheet portal component"
```

---

## Task 6 — `NoteListRow` — swipe delete + ⋯ menu + snippet prop

**Files:**
- Modify: `frontend/src/components/NoteListRow.jsx`

Adds three things:
1. **Swipe left** on mobile reveals a red "Supprimer" strip (70 px). Tapping it deletes.
2. **⋯ button** (always visible on mobile, visible on hover on desktop) opens `MoveNoteSheet`.
3. **`snippet` prop** — when provided by Home's full-text search, shown in italic under the title.

- [ ] **Step 1: Replace the entire file with the new version**

```jsx
// frontend/src/components/NoteListRow.jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, MoreHorizontal, Trash2 } from 'lucide-react';
import { parseScore, scoreColor, subjectColor, subjectColorStyle, subjectDotColor, relativeDate } from '../lib/noteUtils.js';
import SubjectEditor from './SubjectEditor.jsx';
import MoveNoteSheet from './MoveNoteSheet.jsx';
import { useSubjectByName } from '../lib/SubjectsContext.jsx';
import { api } from '../lib/api.js';

const SWIPE_REVEAL  = 72;  // px — largeur du bouton suppression révélé
const SWIPE_TRIGGER = 55;  // px — distance minimale pour déclencher l'ouverture

export default function NoteListRow({ note, snippet = null }) {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const subjectData = useSubjectByName(note.subject);
  const score       = parseScore(note.metadata?.qualite_francais);
  const dot         = subjectDotColor(note.subject ?? '', subjectData?.color ?? null);
  const customStyle = subjectColorStyle(subjectData?.color ?? null);

  const [editorRect, setEditorRect] = useState(null);
  const [showMove, setShowMove]     = useState(false);

  // ── Swipe delete ────────────────────────────────────────────────────────────
  const touchStartX = useRef(0);
  const [swipeX, setSwipeX]         = useState(0);   // 0 → -SWIPE_REVEAL
  const [isSwiping, setIsSwiping]   = useState(false);

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  }
  function onTouchMove(e) {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx > 0) return; // ignore swipe right
    setSwipeX(Math.max(dx, -SWIPE_REVEAL));
  }
  function onTouchEnd() {
    setIsSwiping(false);
    if (swipeX <= -SWIPE_TRIGGER) {
      setSwipeX(-SWIPE_REVEAL); // snap open
    } else {
      setSwipeX(0); // snap closed
    }
  }

  // Ferme le swipe si on clique ailleurs
  function closeSwipe() { setSwipeX(0); }

  // ── Delete mutation ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteNote(note.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden">
      {/* Fond rouge pour swipe delete (mobile) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-status-danger"
        style={{ width: SWIPE_REVEAL }}
      >
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); deleteMutation.mutate(); }}
          className="flex flex-col items-center gap-0.5 text-white px-3"
          disabled={deleteMutation.isPending}
          aria-label="Supprimer"
        >
          <Trash2 size={16} />
          <span className="text-[9px] font-medium">Suppr.</span>
        </button>
      </div>

      {/* Ligne principale — translateX selon swipe */}
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
          background: 'var(--bg-row, transparent)',
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
          <span className="text-[13px] font-medium text-text-primary truncate group-hover:text-text-primary">
            {note.title}
          </span>
          {note.subfolder && (
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

        {/* ⋯ Bouton déplacer — hover desktop / toujours visible mobile */}
        <button
          onClick={e => { e.stopPropagation(); setShowMove(true); }}
          title="Déplacer"
          aria-label="Déplacer la note"
          className="shrink-0 p-1.5 rounded-md text-text-tertiary
            opacity-100 md:opacity-0 md:group-hover:opacity-100
            hover:text-accent hover:bg-accent/10 transition-all duration-150"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Sheet de déplacement */}
      {showMove && (
        <MoveNoteSheet note={note} onClose={() => setShowMove(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify visually**

Run `npm run dev` in the frontend. In the list view:
- Desktop: hover a row → ⋯ button appears on the right → click → MoveNoteSheet opens.
- Mobile (DevTools device mode): swipe left → red strip appears → tap Suppr. → note deleted.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NoteListRow.jsx
git commit -m "feat: swipe-to-delete + move action in NoteListRow"
```

---

## Task 7 — `NoteCard` — ⋯ menu + `metadata.resume` display

**Files:**
- Modify: `frontend/src/components/NoteCard.jsx`

Adds:
1. A ⋯ button in the top-right area (next to the existing delete button) that opens `MoveNoteSheet`.
2. `note.metadata?.resume` displayed under the title in italic, 2 lines max.

- [ ] **Step 1: Add `MoveNoteSheet` import and `showMove` state**

Find the imports block at the top of `frontend/src/components/NoteCard.jsx`. After:
```js
import ConfirmModal from './ConfirmModal.jsx';
```
Add:
```js
import MoveNoteSheet from './MoveNoteSheet.jsx';
```

Find:
```js
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editorRect, setEditorRect]           = useState(null);
```
Add after:
```js
  const [showMove, setShowMove] = useState(false);
```

- [ ] **Step 2: Add the ⋯ button next to the existing delete button**

Find the delete button in the JSX:
```jsx
        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150
            p-1.5 rounded-md text-text-tertiary hover:text-status-danger hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={handleDelete}
          title="Supprimer"
          aria-label="Supprimer la note"
        >
          <Trash2 size={13} />
        </button>
```
Replace with:
```jsx
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
```

- [ ] **Step 3: Add `MoreHorizontal` to the lucide import**

Find:
```js
import { Trash2, FolderOpen } from 'lucide-react';
```
Replace with:
```js
import { Trash2, FolderOpen, MoreHorizontal } from 'lucide-react';
```

- [ ] **Step 4: Display the resume under the title**

Find the title `<h3>` block:
```jsx
      {/* Titre */}
      <h3 className="text-[14px] font-semibold text-text-primary line-clamp-2 leading-snug flex-1">
        {note.title}
      </h3>
```
Replace with:
```jsx
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
```

- [ ] **Step 5: Add MoveNoteSheet to the card JSX (before the closing GlassCard tag)**

Find:
```jsx
      {/* Modal de confirmation suppression */}
      {showDeleteModal && (
```
Insert before that line:
```jsx
      {/* Sheet de déplacement */}
      {showMove && (
        <MoveNoteSheet note={note} onClose={() => setShowMove(false)} />
      )}

```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/NoteCard.jsx
git commit -m "feat: move action + resume display in NoteCard"
```

---

## Task 8 — `Home.jsx` — full-text search via backend

**Files:**
- Modify: `frontend/src/pages/Home.jsx`

When search query ≥ 3 chars (debounced 400 ms), fetch results from `GET /api/notes/search` instead of filtering client-side. Results include a `snippet` field passed to `NoteListRow`. A small spinner appears while loading. Short queries (< 3 chars) continue using the fast client-side filter.

- [ ] **Step 1: Add `useEffect`, `useRef` to imports and `api.searchNotes` usage**

Find the import line:
```js
import { useState, useMemo, useEffect } from 'react';
```
Replace with:
```js
import { useState, useMemo, useEffect, useRef } from 'react';
```

- [ ] **Step 2: Add full-text search state after the existing state declarations**

Find:
```js
  const [view, setView] = useState(
    () => localStorage.getItem('scrip-home-view') ?? 'list',
  );
```
Add immediately after:
```js
  // Full-text search state
  const [ftResults, setFtResults]   = useState(null);   // null = not active, [] = no results
  const [ftLoading, setFtLoading]   = useState(false);
  const ftDebounceRef               = useRef(null);
```

- [ ] **Step 3: Add the debounced search effect**

Find the existing search reset effect:
```js
  // Réinitialiser la recherche quand on change de dossier
  useEffect(() => { setSearch(''); }, [activeSubject]);
```
Add **after** that:
```js
  // Recherche full-text (≥ 3 chars) — debounced 400ms
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
        // Si un filtre matière est actif, restreindre aux notes de cette matière
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
```

- [ ] **Step 4: Update the `filtered` memo to defer to `ftResults` when active**

Find:
```js
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = notes.filter(n => {
      if (activeSubject && n.subject !== activeSubject) return false;
      if (!q) return true;
      return n.title?.toLowerCase().includes(q) || n.subject?.toLowerCase().includes(q);
    });
    return [...result].sort((a, b) => {
```
Replace the entire `filtered` useMemo with:
```js
  const filtered = useMemo(() => {
    // When full-text search is active, use backend results (already filtered/sorted)
    if (ftResults !== null) return ftResults;

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
  }, [notes, search, activeSubject, sort, ftResults]);
```

- [ ] **Step 5: Show a loading spinner in the search input when ftLoading is true**

Find the search input's `{search && (` clear button block:
```jsx
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                    >
                      <X size={11} />
                    </button>
                  )}
```
Replace with:
```jsx
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
```

- [ ] **Step 6: Pass `snippet` to `NoteListRow` in the list view**

Find:
```jsx
                  {filtered.map((note, i) => (
                    <div key={note.id} className={[
                      'row-enter',
                      `row-${Math.min(i + 1, 10)}`,
                      i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : '',
                    ].join(' ')}>
                      <NoteListRow note={note} />
                    </div>
                  ))}
```
Replace with:
```jsx
                  {filtered.map((note, i) => (
                    <div key={note.id} className={[
                      'row-enter',
                      `row-${Math.min(i + 1, 10)}`,
                      i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.04]' : '',
                    ].join(' ')}>
                      <NoteListRow note={note} snippet={note.snippet ?? null} />
                    </div>
                  ))}
```

- [ ] **Step 7: Add a "Recherche dans le contenu" label when full-text is active**

Find:
```jsx
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary flex-shrink-0">
                  {folderTitle}
                  <span className="ml-0.5 text-text-tertiary font-normal text-xs">{filtered.length}</span>
                </h2>
```
Replace with:
```jsx
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-primary flex-shrink-0">
                  {ftResults !== null ? 'Résultats' : folderTitle}
                  <span className="ml-0.5 text-text-tertiary font-normal text-xs">{filtered.length}</span>
                  {ftResults !== null && (
                    <span className="text-[10px] text-accent font-normal bg-accent/10 px-1.5 py-0.5 rounded-full">
                      contenu
                    </span>
                  )}
                </h2>
```

- [ ] **Step 8: Verify end-to-end**

1. Start backend + frontend.
2. Type a word that exists in a note body (not just title). After 400ms, results appear with the matching snippet in italic.
3. Clear the search → back to normal client-side filtered list.
4. Type 2 chars → no backend call, client-side only.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "feat: full-text search via backend with debounce and snippet display"
```

---

## Self-Review

**Spec coverage:**
- ✅ Swipe to delete → Task 6 (NoteListRow touch events + delete mutation)
- ✅ Move to subfolder → Tasks 3 (PATCH extended), 5 (MoveNoteSheet), 6 (⋯ in list), 7 (⋯ in card)
- ✅ Move to other subject → same as above (`subjectId` field in PATCH)
- ✅ Auto-summary during ingest → Tasks 1 (summarize.js) + 2 (ingest integration)
- ✅ Summary display on cards → Task 7 (metadata.resume in NoteCard)
- ✅ Full-text search → Tasks 3 (GET /search), 4 (api.js), 8 (Home.jsx)

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:**
- `note.metadata.resume` (string) — set in Task 2, read in Task 7 ✅
- `note.snippet` (string|null) — set by search endpoint, passed in Task 8, consumed in Task 6 ✅
- `api.searchNotes(q)` — defined in Task 4, called in Task 8 ✅
- `api.patchNoteMeta(id, {subjectId, subfolder})` — backend extended in Task 3, called by MoveNoteSheet in Task 5 ✅
- `SWIPE_REVEAL` / `SWIPE_TRIGGER` — defined and used within Task 6 only ✅
