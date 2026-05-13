# Scrip — Frontend + Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer le pipeline CLI existant via une API Express et une PWA React mobile-first, déployée sur VPS Debian 12 avec Nginx + PM2 + dufs WebDAV.

**Architecture:** Monorepo npm workspaces — `backend/` (Express + lowdb) et `frontend/` (Vite + React + Tailwind). Les modules pipeline existants (`src/`) migrent dans `backend/src/pipeline/`. Le CLI `ingest.js` continue de fonctionner avec ses imports mis à jour.

**Tech Stack:** Node.js 20 ESM, Express 4, lowdb 7, multer, React 18, React Router v6, TanStack Query v5, Tailwind CSS 3, Motion, lucide-react, react-markdown, Vite 5, supertest (tests backend), PM2, Nginx, dufs.

**Spec de référence:** `docs/superpowers/specs/2026-05-13-frontend-backend-design.md`

---

## Carte des fichiers

### Nouveaux fichiers backend
| Fichier | Responsabilité |
|---------|----------------|
| `backend/package.json` | Dépendances backend (express, lowdb, multer, uuid, cors, dotenv) |
| `backend/src/app.js` | Crée et exporte l'app Express (sans listen) — testable |
| `backend/src/server.js` | Importe app.js, appelle listen |
| `backend/src/db.js` | Singleton lowdb, initDb(), chemin configurable via DB_PATH |
| `backend/src/middleware/errorHandler.js` | Gestionnaire d'erreurs Express centralisé |
| `backend/src/routes/settings.js` | GET/PUT /api/settings |
| `backend/src/routes/levels.js` | CRUD /api/levels |
| `backend/src/routes/subjects.js` | CRUD /api/subjects |
| `backend/src/routes/notes.js` | CRUD + PATCH /api/notes |
| `backend/src/routes/ingest.js` | POST /api/ingest (upload + pipeline) |
| `backend/data/db.json` | Base de données lowdb (créée au démarrage) |
| `backend/tests/parseMetadata.test.js` | Tests unitaires parseMetadata |
| `backend/tests/routes.test.js` | Tests d'intégration routes (supertest) |

### Fichiers migrés (src/ → backend/src/pipeline/)
| Avant | Après |
|-------|-------|
| `src/ocr.js` | `backend/src/pipeline/ocr.js` |
| `src/structure.js` | `backend/src/pipeline/structure.js` |
| `src/format.js` | `backend/src/pipeline/format.js` |
| `src/audit.js` | `backend/src/pipeline/audit.js` (+ export parseMetadata) |
| `prompts/shs.js` | `backend/prompts/shs.js` |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `package.json` (racine) | Ajouter `workspaces`, garder scripts test/start |
| `ingest.js` | Mettre à jour les imports vers `./backend/src/pipeline/` |
| `tests/*.test.js` | Mettre à jour les imports |
| `backend/src/pipeline/structure.js` | Ajouter clé `shs` dans PROMPTS (compat backward) |
| `backend/src/pipeline/audit.js` | Ajouter export `parseMetadata` |

### Nouveaux fichiers frontend
| Fichier | Responsabilité |
|---------|----------------|
| `frontend/package.json` | Dépendances frontend |
| `frontend/vite.config.js` | Vite + proxy /api → localhost:3001 |
| `frontend/tailwind.config.js` | darkMode: 'class', tokens CSS du CDC |
| `frontend/postcss.config.js` | tailwindcss + autoprefixer |
| `frontend/index.html` | HTML root + script anti-FOUC thème |
| `frontend/src/app.css` | CSS variables dark/light (tokens CDC §12) |
| `frontend/src/main.jsx` | Entry point React + QueryClient + Router |
| `frontend/src/App.jsx` | Routes React Router v6 |
| `frontend/src/lib/api.js` | Toutes les fonctions fetch vers /api/* |
| `frontend/src/hooks/useTheme.js` | Lit/écrit localStorage, applique .dark sur <html> |
| `frontend/src/hooks/useCamera.js` | Renvoie trigger() + CameraInput (input file hidden) |
| `frontend/src/components/GlassCard.jsx` | Conteneur frosted glass |
| `frontend/src/components/Button.jsx` | Bouton primary/secondary/danger |
| `frontend/src/components/FAB.jsx` | Bouton caméra flottant 72px |
| `frontend/src/components/Input.jsx` | Champ texte avec focus ring |
| `frontend/src/components/BottomSheet.jsx` | Sheet animée qui monte du bas |
| `frontend/src/components/NoteCard.jsx` | Carte cours dans Home |
| `frontend/src/components/ThemeToggle.jsx` | Segmented control 3 options |
| `frontend/src/pages/Home.jsx` | Liste cours + FAB |
| `frontend/src/pages/Capture.jsx` | Capture photo + choix matière |
| `frontend/src/pages/Preview.jsx` | Markdown rendu + édition + suppression |
| `frontend/src/pages/Settings/index.jsx` | Config globale + thème |
| `frontend/src/pages/Settings/LevelsManager.jsx` | CRUD niveaux |
| `frontend/src/pages/Settings/SubjectsManager.jsx` | CRUD matières |
| `frontend/public/manifest.json` | PWA manifest |

### Fichiers déploiement
| Fichier | Responsabilité |
|---------|----------------|
| `ecosystem.config.js` | Config PM2 (backend + dufs) |
| `nginx/scrip.conf` | Config Nginx (HTTPS, proxy, WebDAV, cache) |

---

## Task 1 : Monorepo setup

**Files:**
- Modify: `package.json`
- Create: `backend/package.json`
- Create: `frontend/package.json`

- [ ] **Étape 1 : Lire le package.json actuel**

```bash
cat package.json
```

- [ ] **Étape 2 : Mettre à jour le package.json racine**

Remplacer le contenu par :

```json
{
  "name": "scrip",
  "type": "module",
  "version": "1.0.0",
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "test": "node --test tests/*.test.js",
    "start": "node ingest.js",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "build": "npm run build --workspace=frontend"
  }
}
```

- [ ] **Étape 3 : Créer backend/package.json**

```json
{
  "name": "scrip-backend",
  "type": "module",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.2",
    "lowdb": "^7.0.1",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Étape 4 : Créer frontend/package.json**

```json
{
  "name": "scrip-frontend",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.28.0",
    "lucide-react": "^0.368.0",
    "motion": "^11.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-markdown": "^9.0.1",
    "react-router-dom": "^6.23.0"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.13",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.0"
  }
}
```

- [ ] **Étape 5 : Créer les dossiers nécessaires**

```bash
mkdir -p backend/src/pipeline backend/src/routes backend/src/middleware backend/data backend/tests backend/prompts
mkdir -p frontend/src/pages/Settings frontend/src/components frontend/src/hooks frontend/src/lib frontend/public/icons
mkdir -p nginx logs
```

- [ ] **Étape 6 : Installer les dépendances**

```bash
npm install
```

Expected : `node_modules/` à la racine + `backend/node_modules/` + `frontend/node_modules/` (ou hoisting dans le root node_modules).

- [ ] **Étape 7 : Commit**

```bash
git add package.json backend/package.json frontend/package.json
git commit -m "chore: setup npm workspaces monorepo (backend + frontend)"
```

---

## Task 2 : Migration du pipeline

**Files:**
- Create: `backend/src/pipeline/ocr.js` (copie de src/ocr.js)
- Create: `backend/src/pipeline/structure.js` (copie + ajout clé shs)
- Create: `backend/src/pipeline/format.js` (copie de src/format.js)
- Create: `backend/src/pipeline/audit.js` (copie + export parseMetadata)
- Create: `backend/prompts/shs.js` (copie de prompts/shs.js)
- Modify: `ingest.js` (imports mis à jour)
- Modify: `tests/*.test.js` (imports mis à jour)

- [ ] **Étape 1 : Copier les modules pipeline**

```bash
cp src/ocr.js backend/src/pipeline/ocr.js
cp src/structure.js backend/src/pipeline/structure.js
cp src/format.js backend/src/pipeline/format.js
cp src/audit.js backend/src/pipeline/audit.js
cp prompts/shs.js backend/prompts/shs.js
```

- [ ] **Étape 2 : Mettre à jour les imports dans backend/src/pipeline/structure.js**

Remplacer la ligne d'import shs :

```js
// Avant
import { SHS_SYSTEM_PROMPT, SHS_USER_TEMPLATE } from '../prompts/shs.js';

// Après (chemin relatif depuis pipeline/ vers prompts/)
import { SHS_SYSTEM_PROMPT, SHS_USER_TEMPLATE } from '../../prompts/shs.js';
```

Puis ajouter la clé `shs` dans l'objet PROMPTS (compat backend) tout en gardant les anciennes clés (compat CLI) :

```js
const PROMPTS = {
  // Clés par nom de prompt (système backend)
  shs: { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
  // Compat backward CLI (SCRIP_SUBJECT=histoire)
  histoire:   { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
  géographie: { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
  emc:        { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
};
```

- [ ] **Étape 3 : Ajouter parseMetadata dans backend/src/pipeline/audit.js**

À la fin du fichier, ajouter :

```js
/**
 * Extrait le bloc METADATA HTML commenté de la sortie LLM.
 * @param {string} content - Contenu structuré du LLM
 * @returns {Object|null} Objet avec les champs METADATA, ou null si absent
 */
export function parseMetadata(content) {
  const match = content.match(/<!--\s*METADATA\s*([\s\S]*?)-->/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].trim().split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    const num = Number(val);
    result[key] = isNaN(num) || val === '' ? val : num;
  }
  return result;
}
```

- [ ] **Étape 4 : Mettre à jour les imports dans ingest.js**

```js
// Remplacer
import { runOCR } from './src/ocr.js';
import { structureContent } from './src/structure.js';
import { buildNote } from './src/format.js';
import { writeAuditLog } from './src/audit.js';

// Par
import { runOCR } from './backend/src/pipeline/ocr.js';
import { structureContent } from './backend/src/pipeline/structure.js';
import { buildNote } from './backend/src/pipeline/format.js';
import { writeAuditLog } from './backend/src/pipeline/audit.js';
```

- [ ] **Étape 5 : Mettre à jour les imports dans tests/structure.test.js**

```js
// Remplacer
const { structureContent } = await import('../src/structure.js');
// Par
const { structureContent } = await import('../backend/src/pipeline/structure.js');
```

- [ ] **Étape 6 : Mettre à jour les imports dans tests/ocr.test.js**

```js
// Remplacer
import { ... } from '../src/ocr.js';
// Par
import { ... } from '../backend/src/pipeline/ocr.js';
```

- [ ] **Étape 7 : Mettre à jour les imports dans tests/format.test.js et tests/audit.test.js**

```js
// format.test.js : ../src/format.js → ../backend/src/pipeline/format.js
// audit.test.js  : ../src/audit.js  → ../backend/src/pipeline/audit.js
```

- [ ] **Étape 8 : Vérifier que les tests passent encore**

```bash
npm test
```

Expected : tous les tests passent (15/15).

- [ ] **Étape 9 : Commit**

```bash
git add backend/src/pipeline/ backend/prompts/ ingest.js tests/
git commit -m "refactor: migrate pipeline modules to backend/src/pipeline/"
```

---

## Task 3 : Backend — fondations (db + server)

**Files:**
- Create: `backend/src/db.js`
- Create: `backend/data/db.json`
- Create: `backend/src/middleware/errorHandler.js`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`
- Create: `backend/tests/parseMetadata.test.js`

- [ ] **Étape 1 : Écrire le test parseMetadata**

```js
// backend/tests/parseMetadata.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../src/pipeline/audit.js';

const SAMPLE = `# Un cours

Texte du cours.

<!-- METADATA
qualite_francais: 78
nb_fautes_orthographe: 3
nb_fautes_grammaire: 2
nb_fautes_syntaxe: 1
commentaire: "Bonne qualité globale."
-->`;

test('parseMetadata extrait les champs numériques et texte', () => {
  const result = parseMetadata(SAMPLE);
  assert.equal(result.qualite_francais, 78);
  assert.equal(result.nb_fautes_orthographe, 3);
  assert.equal(result.commentaire, 'Bonne qualité globale.');
});

test('parseMetadata retourne null si pas de bloc METADATA', () => {
  assert.equal(parseMetadata('# Cours sans metadata'), null);
});

test('parseMetadata gère un bloc vide', () => {
  const result = parseMetadata('<!-- METADATA\n-->');
  assert.deepEqual(result, {});
});
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il passe**

```bash
node --test backend/tests/parseMetadata.test.js
```

Expected : 3 tests passent.

- [ ] **Étape 3 : Créer backend/src/db.js**

```js
// backend/src/db.js
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA = {
  settings: {
    theme: 'auto',
    vaultPath: '/home/scrip/vault',
    currentLevelId: null,
  },
  levels: [],
  subjects: [],
  notes: [],
};

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../data/db.json');

// Créer le dossier data/ si nécessaire
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const adapter = new JSONFile(DB_PATH);
export const db = new Low(adapter, DEFAULT_DATA);

/**
 * Initialise la db : lit le fichier, fusionne avec les valeurs par défaut.
 * À appeler au démarrage du serveur.
 */
export async function initDb() {
  await db.read();
  // Fusionner pour s'assurer que toutes les clés existent
  db.data = {
    settings: { ...DEFAULT_DATA.settings, ...db.data.settings },
    levels:   db.data.levels   ?? [],
    subjects: db.data.subjects ?? [],
    notes:    db.data.notes    ?? [],
  };
  await db.write();
}
```

- [ ] **Étape 4 : Créer backend/src/middleware/errorHandler.js**

```js
// backend/src/middleware/errorHandler.js

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err.message);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Erreur interne du serveur' });
}
```

- [ ] **Étape 5 : Créer backend/src/app.js**

```js
// backend/src/app.js
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { settingsRouter } from './routes/settings.js';
import { levelsRouter } from './routes/levels.js';
import { subjectsRouter } from './routes/subjects.js';
import { notesRouter } from './routes/notes.js';
import { ingestRouter } from './routes/ingest.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/settings', settingsRouter);
  app.use('/api/levels',   levelsRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/notes',    notesRouter);
  app.use('/api/ingest',   ingestRouter);

  app.use(errorHandler);
  return app;
}
```

- [ ] **Étape 6 : Créer backend/src/server.js**

```js
// backend/src/server.js
import 'dotenv/config';
import { createApp } from './app.js';
import { initDb } from './db.js';

const PORT = process.env.PORT ?? 3001;

await initDb();
const app = createApp();
app.listen(PORT, () => {
  console.log(`[scrip-backend] http://localhost:${PORT}`);
});
```

- [ ] **Étape 7 : Vérifier que le serveur démarre**

```bash
cd backend && MISTRAL_API_KEY=fake OPENROUTER_API_KEY=fake node src/server.js
```

Expected : `[scrip-backend] http://localhost:3001` affiché, pas d'erreur.
Ctrl+C pour arrêter.

- [ ] **Étape 8 : Commit**

```bash
git add backend/src/db.js backend/src/middleware/ backend/src/app.js backend/src/server.js backend/tests/parseMetadata.test.js
git commit -m "feat(backend): add db (lowdb), app factory, server entry point"
```

---

## Task 4 : Routes settings + levels (+ tests)

**Files:**
- Create: `backend/src/routes/settings.js`
- Create: `backend/src/routes/levels.js`
- Create: `backend/tests/routes.test.js`

- [ ] **Étape 1 : Créer backend/src/routes/settings.js**

```js
// backend/src/routes/settings.js
import { Router } from 'express';
import { db } from '../db.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.settings);
});

settingsRouter.put('/', async (req, res) => {
  await db.read();
  const allowed = ['theme', 'vaultPath', 'currentLevelId'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.data.settings[key] = req.body[key];
    }
  }
  await db.write();
  res.json(db.data.settings);
});
```

- [ ] **Étape 2 : Créer backend/src/routes/levels.js**

```js
// backend/src/routes/levels.js
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const levelsRouter = Router();

levelsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.levels);
});

levelsRouter.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  await db.read();
  const level = { id: randomUUID(), name: name.trim() };
  db.data.levels.push(level);
  await db.write();
  res.status(201).json(level);
});

levelsRouter.patch('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  await db.read();
  const level = db.data.levels.find(l => l.id === req.params.id);
  if (!level) return res.status(404).json({ error: 'niveau introuvable' });
  level.name = name.trim();
  await db.write();
  res.json(level);
});

levelsRouter.delete('/:id', async (req, res) => {
  await db.read();
  const linked = db.data.subjects.some(s => s.levelId === req.params.id);
  if (linked) {
    return res.status(409).json({
      error: 'Ce niveau contient des matières — supprimez-les d\'abord',
    });
  }
  db.data.levels = db.data.levels.filter(l => l.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
```

- [ ] **Étape 3 : Créer backend/tests/routes.test.js**

```js
// backend/tests/routes.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Utiliser une db temporaire pour les tests
const tmpDb = path.join(os.tmpdir(), `scrip-test-${Date.now()}.json`);
process.env.DB_PATH = tmpDb;

// Importer après avoir défini DB_PATH
const { default: supertest } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { initDb } = await import('../src/db.js');

let request;

before(async () => {
  await initDb();
  request = supertest(createApp());
});

after(() => {
  if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
});

// ── Settings ────────────────────────────────────────────────
test('GET /api/settings retourne les settings par défaut', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.theme, 'auto');
});

test('PUT /api/settings met à jour le thème', async () => {
  const res = await request.put('/api/settings').send({ theme: 'dark' });
  assert.equal(res.status, 200);
  assert.equal(res.body.theme, 'dark');
});

// ── Levels ──────────────────────────────────────────────────
test('POST /api/levels crée un niveau', async () => {
  const res = await request.post('/api/levels').send({ name: '1ère' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, '1ère');
  assert.ok(res.body.id);
});

test('POST /api/levels — 400 si name manquant', async () => {
  const res = await request.post('/api/levels').send({});
  assert.equal(res.status, 400);
});

test('GET /api/levels liste les niveaux', async () => {
  const res = await request.get('/api/levels');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 1);
});

test('DELETE /api/levels/:id — 409 si matières liées', async () => {
  // Créer un niveau
  const lvl = (await request.post('/api/levels').send({ name: 'Test' })).body;
  // Créer une matière liée
  await request.post('/api/subjects').send({
    name: 'Histoire', levelId: lvl.id, prompt: 'shs', outputFolder: 'Histoire',
  });
  // Tenter de supprimer le niveau
  const res = await request.delete(`/api/levels/${lvl.id}`);
  assert.equal(res.status, 409);
});
```

- [ ] **Étape 4 : Lancer les tests**

```bash
node --test backend/tests/routes.test.js
```

Expected : tous les tests passent.

- [ ] **Étape 5 : Commit**

```bash
git add backend/src/routes/settings.js backend/src/routes/levels.js backend/tests/routes.test.js
git commit -m "feat(backend): add settings + levels routes with tests"
```

---

## Task 5 : Routes subjects + notes

**Files:**
- Create: `backend/src/routes/subjects.js`
- Create: `backend/src/routes/notes.js`

- [ ] **Étape 1 : Créer backend/src/routes/subjects.js**

```js
// backend/src/routes/subjects.js
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const subjectsRouter = Router();

subjectsRouter.get('/', async (req, res) => {
  await db.read();
  let subjects = db.data.subjects;
  if (req.query.levelId) {
    subjects = subjects.filter(s => s.levelId === req.query.levelId);
  }
  res.json(subjects);
});

subjectsRouter.post('/', async (req, res) => {
  const { name, levelId, prompt, outputFolder } = req.body;
  if (!name?.trim() || !levelId || !prompt || !outputFolder) {
    return res.status(400).json({ error: 'name, levelId, prompt et outputFolder requis' });
  }
  await db.read();
  if (!db.data.levels.some(l => l.id === levelId)) {
    return res.status(400).json({ error: 'niveau introuvable' });
  }
  const subject = { id: randomUUID(), name: name.trim(), levelId, prompt, outputFolder };
  db.data.subjects.push(subject);
  await db.write();
  res.status(201).json(subject);
});

subjectsRouter.patch('/:id', async (req, res) => {
  await db.read();
  const subject = db.data.subjects.find(s => s.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'matière introuvable' });
  for (const key of ['name', 'prompt', 'outputFolder']) {
    if (req.body[key] !== undefined) subject[key] = req.body[key];
  }
  await db.write();
  res.json(subject);
});

subjectsRouter.delete('/:id', async (req, res) => {
  await db.read();
  const linked = db.data.notes.some(n => n.subjectId === req.params.id);
  if (linked) {
    return res.status(409).json({
      error: 'Cette matière contient des notes — supprimez-les d\'abord',
    });
  }
  db.data.subjects = db.data.subjects.filter(s => s.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
```

- [ ] **Étape 2 : Créer backend/src/routes/notes.js**

```js
// backend/src/routes/notes.js
import { Router } from 'express';
import fs from 'node:fs';
import { db } from '../db.js';

export const notesRouter = Router();

notesRouter.get('/', async (req, res) => {
  await db.read();
  const notes = [...db.data.notes].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(notes);
});

notesRouter.get('/:id', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  const markdown = fs.existsSync(note.path)
    ? fs.readFileSync(note.path, 'utf8')
    : '';
  res.json({ ...note, markdown });
});

notesRouter.patch('/:id', async (req, res) => {
  const { markdown } = req.body;
  if (typeof markdown !== 'string') {
    return res.status(400).json({ error: 'markdown (string) requis' });
  }
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  fs.writeFileSync(note.path, markdown, 'utf8');
  note.updatedAt = new Date().toISOString();
  await db.write();
  res.json(note);
});

notesRouter.delete('/:id', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  if (fs.existsSync(note.path)) fs.unlinkSync(note.path);
  if (note.auditPath && fs.existsSync(note.auditPath)) {
    fs.unlinkSync(note.auditPath);
  }
  db.data.notes = db.data.notes.filter(n => n.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
```

- [ ] **Étape 3 : Vérifier que tous les tests backend passent encore**

```bash
node --test backend/tests/routes.test.js
node --test backend/tests/parseMetadata.test.js
```

Expected : tous passent.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/routes/subjects.js backend/src/routes/notes.js
git commit -m "feat(backend): add subjects + notes routes"
```

---

## Task 6 : Route ingest

**Files:**
- Create: `backend/src/routes/ingest.js`

- [ ] **Étape 1 : Créer backend/src/routes/ingest.js**

```js
// backend/src/routes/ingest.js
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { runOCR } from '../pipeline/ocr.js';
import { structureContent } from '../pipeline/structure.js';
import { buildNote } from '../pipeline/format.js';
import { writeAuditLog, parseMetadata } from '../pipeline/audit.js';

const upload = multer({ dest: '/tmp/scrip-uploads/' });
export const ingestRouter = Router();

function sanitizeFilename(name) {
  return name
    .replace(/[—–]/g, '-')
    .replace(/[/\\:*?"<>|]/g, '-')
    .trim();
}

function nextAvailablePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let n = 1;
  while (fs.existsSync(path.join(dir, `${base} (${n})${ext}`))) n++;
  return path.join(dir, `${base} (${n})${ext}`);
}

ingestRouter.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo requise' });

    const { subjectId, levelId } = req.body;
    await db.read();

    const subject = db.data.subjects.find(s => s.id === subjectId);
    if (!subject) return res.status(400).json({ error: 'matière introuvable' });

    const level = db.data.levels.find(
      l => l.id === (levelId ?? subject.levelId)
    );
    if (!level) return res.status(400).json({ error: 'niveau introuvable' });

    const mistralKey = process.env.MISTRAL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    // Pipeline IA
    const { rawMarkdown, imageRegions } = await runOCR(req.file.path, mistralKey);
    const structured = await structureContent(
      rawMarkdown, subject.prompt, level.name, openrouterKey, mistralKey
    );

    const now = new Date();
    const note = buildNote(structured, {
      subject: subject.name,
      level: level.name,
      dateCours: now.toISOString().split('T')[0],
      dateIngestion: now.toISOString(),
      sources: [req.file.originalname],
    });

    // Extraire le titre depuis le contenu structuré
    const titleMatch = structured.match(/^#\s+(?![IVX]+[-.\s]|\d+[-.\s])(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].trim()
      : path.basename(req.file.originalname, path.extname(req.file.originalname));

    // Sauvegarder sur disque dans le vault
    const vaultPath = db.data.settings.vaultPath;
    const noteDir = path.join(vaultPath, level.name, subject.outputFolder);
    fs.mkdirSync(noteDir, { recursive: true });

    const notePath = nextAvailablePath(
      path.join(noteDir, `${sanitizeFilename(title)}.md`)
    );
    fs.writeFileSync(notePath, note, 'utf8');

    // Nettoyer le fichier uploadé temporaire
    fs.unlinkSync(req.file.path);

    // Audit log
    const auditPath = writeAuditLog(
      structured, imageRegions, req.file.originalname, now.toISOString()
    );
    const metadata = parseMetadata(structured);

    const noteRecord = {
      id: randomUUID(),
      title,
      subjectId: subject.id,
      levelId: level.id,
      path: notePath,
      auditPath: auditPath ?? null,
      createdAt: now.toISOString(),
      metadata,
    };

    db.data.notes.push(noteRecord);
    await db.write();

    res.status(201).json({ note: noteRecord, markdown: note });
  } catch (err) {
    // Nettoyer le fichier upload en cas d'erreur
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
});
```

- [ ] **Étape 2 : Vérifier que le serveur démarre sans erreur**

```bash
cd backend && MISTRAL_API_KEY=fake OPENROUTER_API_KEY=fake node src/server.js
```

Expected : démarrage sans erreur, port 3001 affiché. Ctrl+C.

- [ ] **Étape 3 : Tester manuellement l'endpoint settings via curl**

```bash
curl http://localhost:3001/api/settings
```

Expected : `{"theme":"auto","vaultPath":"/home/scrip/vault","currentLevelId":null}`

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/routes/ingest.js
git commit -m "feat(backend): add ingest route (upload + OCR + LLM pipeline)"
```

---

## Task 7 : Frontend — init Vite + Tailwind

**Files:**
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/app.css`

- [ ] **Étape 1 : Créer frontend/vite.config.js**

```js
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En développement, /api est redirigé vers le backend local
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Étape 2 : Créer frontend/tailwind.config.js**

```js
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // toggle via classe .dark sur <html>
  theme: {
    extend: {
      colors: {
        'bg-base':        'rgb(var(--bg-base) / <alpha-value>)',
        'bg-elevated':    'rgb(var(--bg-elevated) / <alpha-value>)',
        'text-primary':   'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-tertiary':  'rgb(var(--text-tertiary) / <alpha-value>)',
        'accent':         'rgb(var(--accent) / <alpha-value>)',
        'status-success': 'rgb(var(--success) / <alpha-value>)',
        'status-warning': 'rgb(var(--warning) / <alpha-value>)',
        'status-danger':  'rgb(var(--danger) / <alpha-value>)',
      },
      borderRadius: {
        'sm':  '8px',
        'md':  '14px',
        'lg':  '20px',
        'xl':  '28px',
        '2xl': '36px',
      },
      backdropBlur: {
        'glass': '24px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    (await import('@tailwindcss/typography')).default,
  ],
};
```

- [ ] **Étape 3 : Créer frontend/postcss.config.js**

```js
// frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Étape 4 : Créer frontend/index.html**

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0A0A0B" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <title>Scrip</title>
    <!--
      Script anti-FOUC : s'exécute AVANT React.
      Lit localStorage et applique .dark sur <html> immédiatement.
      Sans ça, l'app flashe en mode clair avant que React charge le thème.
    -->
    <script>
      (function () {
        var s = localStorage.getItem('scrip.theme');
        var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (s === 'dark' || (s === 'auto' && dark) || (!s && dark)) {
          document.documentElement.classList.add('dark');
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Étape 5 : Créer frontend/src/app.css**

```css
/* frontend/src/app.css */

/* ── Tokens mode clair (défaut) ──────────────────────────── */
:root {
  --bg-base:      250 250 251;
  --bg-elevated:  255 255 255;
  --text-primary: 10 10 11;
  --text-secondary: 90 90 96;
  --text-tertiary:  154 154 160;
  --accent:   110 108 232;
  --success:  43 165 111;
  --warning:  185 122 28;
  --danger:   201 69 69;
}

/* ── Tokens mode sombre ──────────────────────────────────── */
.dark {
  --bg-base:      10 10 11;
  --bg-elevated:  20 20 22;
  --text-primary: 236 236 238;
  --text-secondary: 154 154 160;
  --text-tertiary:  90 90 96;
  --accent:   124 122 255;
  --success:  94 224 168;
  --warning:  245 194 107;
  --danger:   244 114 114;
}

/* ── Transition thème fluide ─────────────────────────────── */
*, *::before, *::after {
  transition-property: background-color, color, border-color;
  transition-duration: 200ms;
  transition-timing-function: ease;
}

/* ── Reset de base ───────────────────────────────────────── */
body {
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Scrollbar discrète ──────────────────────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(var(--text-tertiary) / 0.4); border-radius: 2px; }
```

- [ ] **Étape 6 : Vérifier que Vite démarre**

```bash
# Dans un terminal — démarrer le backend
cd backend && MISTRAL_API_KEY=fake OPENROUTER_API_KEY=fake node src/server.js &

# Dans un autre terminal — démarrer le frontend
cd frontend && npx vite
```

Expected : `http://localhost:5173` s'ouvre (page blanche pour l'instant, pas d'erreur console).

- [ ] **Étape 7 : Commit**

```bash
git add frontend/vite.config.js frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html frontend/src/app.css
git commit -m "feat(frontend): init Vite + React + Tailwind + CSS design tokens"
```

---

## Task 8 : Composants de base

**Files:**
- Create: `frontend/src/components/GlassCard.jsx`
- Create: `frontend/src/components/Button.jsx`
- Create: `frontend/src/components/Input.jsx`
- Create: `frontend/src/components/FAB.jsx`
- Create: `frontend/src/components/BottomSheet.jsx`
- Create: `frontend/src/components/NoteCard.jsx`

- [ ] **Étape 1 : GlassCard.jsx**

```jsx
// frontend/src/components/GlassCard.jsx

/**
 * Conteneur frosted glass.
 * Mode sombre : fond sombre semi-transparent, ombre forte.
 * Mode clair  : fond blanc semi-transparent, ombre douce.
 */
export default function GlassCard({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-lg',
        // Mode clair
        'bg-white/70',
        'border border-black/[0.08]',
        'shadow-[0_8px_32px_rgba(10,10,12,0.08)]',
        // Mode sombre
        'dark:bg-bg-elevated/60',
        'dark:border-white/10',
        'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)]',
        // Blur
        'backdrop-blur-glass',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
```

- [ ] **Étape 2 : Button.jsx**

```jsx
// frontend/src/components/Button.jsx

const VARIANTS = {
  primary:   'bg-accent text-white font-semibold dark:text-bg-base',
  secondary: 'border border-black/[0.08] dark:border-white/10 text-text-primary',
  danger:    'bg-status-danger/10 text-status-danger border border-status-danger/20',
};

export default function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-14 px-6 rounded-md',
        'text-[15px] font-semibold',
        'transition-all duration-100',
        'active:scale-[0.96]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
```

- [ ] **Étape 3 : Input.jsx**

```jsx
// frontend/src/components/Input.jsx

export default function Input({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm text-text-secondary">{label}</label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'h-12 px-4 rounded-md',
          'bg-black/[0.03] dark:bg-white/[0.04]',
          'border border-black/[0.08] dark:border-white/[0.06]',
          'text-text-primary placeholder:text-text-tertiary',
          'text-[15px]',
          'focus:outline-none',
          'focus:border-accent/40',
          'focus:shadow-[0_0_0_4px_rgb(var(--accent)/0.15)]',
          'transition-all duration-150',
        ].join(' ')}
      />
    </div>
  );
}
```

- [ ] **Étape 4 : FAB.jsx**

```jsx
// frontend/src/components/FAB.jsx
import { Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

/**
 * Floating Action Button — bouton caméra centré en bas d'écran.
 * Pouce-friendly : 72×72px, radius full.
 */
export default function FAB() {
  const navigate = useNavigate();
  return (
    <motion.button
      onClick={() => navigate('/capture')}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1 }}
      aria-label="Capturer un cours"
      className={[
        'fixed bottom-6 left-1/2 -translate-x-1/2',
        'w-[72px] h-[72px] rounded-full',
        'bg-accent',
        'text-white dark:text-bg-base',
        'flex items-center justify-center',
        'shadow-[0_4px_24px_rgb(var(--accent)/0.4)]',
        'z-50',
      ].join(' ')}
    >
      <Camera size={28} />
    </motion.button>
  );
}
```

- [ ] **Étape 5 : BottomSheet.jsx**

```jsx
// frontend/src/components/BottomSheet.jsx
import { motion, AnimatePresence } from 'motion/react';

const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 1 };

/**
 * Sheet animée qui monte du bas.
 * - Overlay cliquable pour fermer.
 * - Radius xl en haut uniquement.
 */
export default function BottomSheet({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay sombre */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            className={[
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-bg-elevated',
              'rounded-t-xl',
              'max-h-[90vh] overflow-y-auto',
              'pb-safe-bottom',
            ].join(' ')}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Étape 6 : NoteCard.jsx**

```jsx
// frontend/src/components/NoteCard.jsx
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard.jsx';

export default function NoteCard({ note }) {
  const navigate = useNavigate();
  const date = new Date(note.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  const score = note.metadata?.qualite_francais;

  return (
    <GlassCard
      className="p-4 cursor-pointer active:scale-[0.98] transition-transform duration-100"
      onClick={() => navigate(`/preview/${note.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-text-primary truncate">
            {note.title}
          </h3>
          <p className="text-sm text-text-secondary mt-0.5">{date}</p>
        </div>
        {score != null && (
          <span className="text-xs font-mono text-text-tertiary shrink-0 mt-0.5">
            {score}/100
          </span>
        )}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Étape 7 : Commit**

```bash
git add frontend/src/components/
git commit -m "feat(frontend): add base components (GlassCard, Button, Input, FAB, BottomSheet, NoteCard)"
```

---

## Task 9 : Système de thème

**Files:**
- Create: `frontend/src/hooks/useTheme.js`
- Create: `frontend/src/components/ThemeToggle.jsx`

- [ ] **Étape 1 : Créer frontend/src/hooks/useTheme.js**

```js
// frontend/src/hooks/useTheme.js
import { useState, useEffect } from 'react';

/**
 * Gère le thème dark/light/auto.
 * - Lit depuis localStorage ('scrip.theme')
 * - Applique/retire la classe .dark sur <html>
 * - En mode 'auto' : écoute prefers-color-scheme en temps réel
 */
export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('scrip.theme') ?? 'auto'
  );

  function applyTheme(t) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = t === 'dark' || (t === 'auto' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  }

  function setTheme(t) {
    localStorage.setItem('scrip.theme', t);
    setThemeState(t);
    applyTheme(t);
  }

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto') return;

    // En mode auto : écouter les changements système
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme };
}
```

- [ ] **Étape 2 : Créer frontend/src/components/ThemeToggle.jsx**

```jsx
// frontend/src/components/ThemeToggle.jsx
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.js';

const OPTIONS = [
  { value: 'dark',  Icon: Moon,    label: 'Sombre' },
  { value: 'light', Icon: Sun,     label: 'Clair'  },
  { value: 'auto',  Icon: Monitor, label: 'Auto'   },
];

/**
 * Segmented control 3 options : Sombre / Clair / Auto.
 * Option active = fond accent.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-md overflow-hidden border border-black/[0.08] dark:border-white/10">
      {OPTIONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={[
            'flex-1 flex items-center justify-center gap-1.5',
            'h-10 px-3 text-sm transition-colors duration-150',
            theme === value
              ? 'bg-accent text-white dark:text-bg-base font-semibold'
              : 'text-text-secondary hover:text-text-primary',
          ].join(' ')}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/hooks/useTheme.js frontend/src/components/ThemeToggle.jsx
git commit -m "feat(frontend): add theme system (useTheme hook + ThemeToggle)"
```

---

## Task 10 : App shell (main.jsx, App.jsx, api.js)

**Files:**
- Create: `frontend/src/lib/api.js`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`

- [ ] **Étape 1 : Créer frontend/src/lib/api.js**

```js
// frontend/src/lib/api.js

/**
 * Client HTTP vers l'API backend.
 * Toutes les fonctions sont des async qui throw en cas d'erreur HTTP.
 */

async function request(method, path, body, isMultipart = false) {
  const opts = { method, headers: {} };

  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body; // FormData — pas de Content-Type manuel
  }

  const res = await fetch(`/api${path}`, opts);

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export const api = {
  // ── Notes ──────────────────────────────────────────────
  getNotes:   ()           => request('GET',    '/notes'),
  getNote:    (id)         => request('GET',    `/notes/${id}`),
  patchNote:  (id, md)     => request('PATCH',  `/notes/${id}`, { markdown: md }),
  deleteNote: (id)         => request('DELETE', `/notes/${id}`),

  // ── Ingest ─────────────────────────────────────────────
  ingest: (photo, subjectId, levelId) => {
    const fd = new FormData();
    fd.append('photo', photo);
    fd.append('subjectId', subjectId);
    if (levelId) fd.append('levelId', levelId);
    return request('POST', '/ingest', fd, true);
  },

  // ── Levels ─────────────────────────────────────────────
  getLevels:   ()           => request('GET',    '/levels'),
  createLevel: (name)       => request('POST',   '/levels', { name }),
  patchLevel:  (id, name)   => request('PATCH',  `/levels/${id}`, { name }),
  deleteLevel: (id)         => request('DELETE', `/levels/${id}`),

  // ── Subjects ───────────────────────────────────────────
  getSubjects:   (levelId) => request('GET',    `/subjects${levelId ? `?levelId=${levelId}` : ''}`),
  createSubject: (data)    => request('POST',   '/subjects', data),
  patchSubject:  (id, data)=> request('PATCH',  `/subjects/${id}`, data),
  deleteSubject: (id)      => request('DELETE', `/subjects/${id}`),

  // ── Settings ───────────────────────────────────────────
  getSettings: ()     => request('GET', '/settings'),
  putSettings: (data) => request('PUT', '/settings', data),
};
```

- [ ] **Étape 2 : Créer frontend/src/main.jsx**

```jsx
// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './app.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s avant de refetch
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Étape 3 : Créer frontend/src/App.jsx**

```jsx
// frontend/src/App.jsx
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Capture from './pages/Capture.jsx';
import Preview from './pages/Preview.jsx';
import Settings from './pages/Settings/index.jsx';
import LevelsManager from './pages/Settings/LevelsManager.jsx';
import SubjectsManager from './pages/Settings/SubjectsManager.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Routes>
        <Route path="/"                   element={<Home />} />
        <Route path="/capture"            element={<Capture />} />
        <Route path="/preview/:noteId"    element={<Preview />} />
        <Route path="/settings"           element={<Settings />} />
        <Route path="/settings/levels"    element={<LevelsManager />} />
        <Route path="/settings/subjects"  element={<SubjectsManager />} />
      </Routes>
    </div>
  );
}
```

- [ ] **Étape 4 : Vérifier que Vite compile sans erreur**

```bash
cd frontend && npx vite build
```

Expected : build réussi dans `frontend/dist/`.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/lib/api.js frontend/src/main.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add app shell (main, router, api client)"
```

---

## Task 11 : Page Home

**Files:**
- Create: `frontend/src/pages/Home.jsx`

- [ ] **Étape 1 : Créer frontend/src/pages/Home.jsx**

```jsx
// frontend/src/pages/Home.jsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { api } from '../lib/api.js';
import NoteCard from '../components/NoteCard.jsx';
import FAB from '../components/FAB.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getNotes,
  });

  return (
    <div className="min-h-screen pb-28">
      {/* Header sticky avec blur au scroll */}
      <header className={[
        'sticky top-0 z-10',
        'px-4 pt-4 pb-3',
        'backdrop-blur-glass',
        'bg-bg-base/80',
        'border-b border-black/[0.06] dark:border-white/[0.06]',
      ].join(' ')}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Scrip
          </h1>
          <button
            onClick={() => navigate('/settings')}
            className="text-text-secondary p-2 -mr-2"
            aria-label="Paramètres"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Liste des cours */}
      <main className="px-4 pt-4 max-w-2xl mx-auto space-y-3">
        {isLoading && (
          <p className="text-text-tertiary text-sm text-center pt-8">
            Chargement...
          </p>
        )}
        {!isLoading && notes.length === 0 && (
          <div className="text-center pt-20 space-y-2">
            <p className="text-4xl">📸</p>
            <p className="text-text-secondary text-sm">
              Aucun cours — capture ta première photo !
            </p>
          </div>
        )}
        {notes.map(note => (
          <NoteCard key={note.id} note={note} />
        ))}
      </main>

      <FAB />
    </div>
  );
}
```

- [ ] **Étape 2 : Commit**

```bash
git add frontend/src/pages/Home.jsx
git commit -m "feat(frontend): add Home page"
```

---

## Task 12 : Page Capture

**Files:**
- Create: `frontend/src/hooks/useCamera.js`
- Create: `frontend/src/pages/Capture.jsx`

- [ ] **Étape 1 : Créer frontend/src/hooks/useCamera.js**

```js
// frontend/src/hooks/useCamera.js
import { useRef } from 'react';

/**
 * Gère la capture photo via l'input file natif.
 * - Sur mobile : ouvre la caméra arrière (capture="environment")
 * - Sur desktop : ouvre l'explorateur de fichiers
 *
 * Retourne :
 * - trigger()    : ouvre le sélecteur de fichier
 * - CameraInput  : composant <input hidden> à placer dans le DOM
 */
export function useCamera({ onCapture }) {
  const inputRef = useRef(null);

  function trigger() {
    inputRef.current?.click();
  }

  function handleChange(e) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    // Reset pour permettre de re-sélectionner le même fichier
    e.target.value = '';
  }

  function CameraInput() {
    return (
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
    );
  }

  return { trigger, CameraInput };
}
```

- [ ] **Étape 2 : Créer frontend/src/pages/Capture.jsx**

```jsx
// frontend/src/pages/Capture.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCamera } from '../hooks/useCamera.js';
import Button from '../components/Button.jsx';
import GlassCard from '../components/GlassCard.jsx';

export default function Capture() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState(null);
  const [subjectId, setSubjectId] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', settings?.currentLevelId],
    queryFn: () => api.getSubjects(settings?.currentLevelId),
    enabled: !!settings?.currentLevelId,
  });

  const { trigger, CameraInput } = useCamera({ onCapture: setPhoto });

  const ingest = useMutation({
    mutationFn: () => api.ingest(photo, subjectId, settings?.currentLevelId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      navigate(`/preview/${data.note.id}`);
    },
  });

  return (
    <div className="min-h-screen p-4">
      <CameraInput />

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Retour</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">
        Capturer un cours
      </h2>

      <div className="space-y-4 max-w-lg">
        {/* Zone photo */}
        <GlassCard className="p-4">
          {photo ? (
            <div className="space-y-3">
              <img
                src={URL.createObjectURL(photo)}
                alt="aperçu du cours"
                className="w-full rounded-md object-cover max-h-72"
              />
              <button
                onClick={trigger}
                className="text-sm text-accent"
              >
                Changer la photo
              </button>
            </div>
          ) : (
            <button
              onClick={trigger}
              className="w-full h-44 flex flex-col items-center justify-center gap-3 text-text-tertiary"
            >
              <span className="text-5xl">📸</span>
              <span className="text-sm">Appuyer pour capturer</span>
            </button>
          )}
        </GlassCard>

        {/* Sélecteur matière */}
        <GlassCard className="p-4 space-y-2">
          <label className="text-sm text-text-secondary">Matière</label>
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className={[
              'w-full h-12 px-4 rounded-md',
              'bg-black/[0.03] dark:bg-white/[0.04]',
              'border border-black/[0.08] dark:border-white/[0.06]',
              'text-text-primary text-[15px]',
              'focus:outline-none',
            ].join(' ')}
          >
            <option value="">Choisir une matière...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {subjects.length === 0 && settings?.currentLevelId && (
            <p className="text-xs text-text-tertiary">
              Aucune matière pour ce niveau —{' '}
              <button
                className="text-accent underline"
                onClick={() => navigate('/settings/subjects')}
              >
                en ajouter
              </button>
            </p>
          )}
        </GlassCard>

        {/* Erreur */}
        {ingest.error && (
          <p className="text-status-danger text-sm px-1">
            {ingest.error.message}
          </p>
        )}

        {/* CTA */}
        <Button
          className="w-full"
          onClick={() => ingest.mutate()}
          disabled={!photo || !subjectId || ingest.isPending}
        >
          {ingest.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Traitement en cours...
            </span>
          ) : (
            'Ingérer le cours'
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/hooks/useCamera.js frontend/src/pages/Capture.jsx
git commit -m "feat(frontend): add Capture page + useCamera hook"
```

---

## Task 13 : Page Preview

**Files:**
- Create: `frontend/src/pages/Preview.jsx`

- [ ] **Étape 1 : Créer frontend/src/pages/Preview.jsx**

```jsx
// frontend/src/pages/Preview.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Edit2, Trash2, Check, X } from 'lucide-react';
import { api } from '../lib/api.js';
import GlassCard from '../components/GlassCard.jsx';
import Button from '../components/Button.jsx';

export default function Preview() {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api.getNote(noteId),
  });

  // Initialiser le draft quand les données arrivent
  useEffect(() => {
    if (data?.markdown) setDraft(data.markdown);
  }, [data?.markdown]);

  const patchNote = useMutation({
    mutationFn: (md) => api.patchNote(noteId, md),
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

  if (isLoading) {
    return (
      <div className="p-4 text-text-tertiary text-sm">Chargement...</div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-status-danger text-sm">{error.message}</div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header sticky */}
      <header className={[
        'sticky top-0 z-10',
        'px-4 py-3',
        'backdrop-blur-glass bg-bg-base/80',
        'border-b border-black/[0.06] dark:border-white/[0.06]',
      ].join(' ')}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="text-text-secondary p-1 -ml-1"
            aria-label="Retour"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="text-text-secondary p-2"
                  aria-label="Annuler"
                >
                  <X size={18} />
                </button>
                <Button
                  onClick={() => patchNote.mutate(draft)}
                  disabled={patchNote.isPending}
                  className="h-9 text-sm px-4"
                >
                  <Check size={14} className="inline mr-1" />
                  Sauvegarder
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-text-secondary p-2"
                  aria-label="Éditer"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Supprimer ce cours ?')) deleteNote.mutate();
                  }}
                  className="text-status-danger p-2"
                  aria-label="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 max-w-2xl mx-auto">
        {editing ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className={[
              'w-full h-[75vh] p-4 rounded-md',
              'bg-black/[0.03] dark:bg-white/[0.04]',
              'border border-black/[0.08] dark:border-white/[0.06]',
              'text-text-primary font-mono text-sm',
              'resize-none focus:outline-none',
              'focus:border-accent/40',
            ].join(' ')}
          />
        ) : (
          <GlassCard className="p-6">
            {/* prose : typo Tailwind pour le rendu markdown */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{data?.markdown ?? ''}</ReactMarkdown>
            </div>
          </GlassCard>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Étape 2 : Commit**

```bash
git add frontend/src/pages/Preview.jsx
git commit -m "feat(frontend): add Preview page (markdown render + edit + delete)"
```

---

## Task 14 : Pages Settings

**Files:**
- Create: `frontend/src/pages/Settings/index.jsx`
- Create: `frontend/src/pages/Settings/LevelsManager.jsx`
- Create: `frontend/src/pages/Settings/SubjectsManager.jsx`

- [ ] **Étape 1 : Créer frontend/src/pages/Settings/index.jsx**

```jsx
// frontend/src/pages/Settings/index.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';

const NAV_ITEMS = [
  { label: 'Gérer les niveaux',  path: '/settings/levels' },
  { label: 'Gérer les matières', path: '/settings/subjects' },
];

export default function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });
  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: api.getLevels,
  });

  const updateSettings = useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return (
    <div className="min-h-screen p-4">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Retour</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">Paramètres</h2>

      <div className="space-y-3 max-w-lg">
        {/* Thème */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">
            Thème
          </h3>
          <ThemeToggle />
        </GlassCard>

        {/* Niveau courant */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">
            Niveau actuel
          </h3>
          <select
            value={settings?.currentLevelId ?? ''}
            onChange={e => updateSettings.mutate({ currentLevelId: e.target.value })}
            className={[
              'w-full h-12 px-4 rounded-md',
              'bg-black/[0.03] dark:bg-white/[0.04]',
              'border border-black/[0.08] dark:border-white/[0.06]',
              'text-text-primary text-[15px]',
              'focus:outline-none',
            ].join(' ')}
          >
            <option value="">Choisir un niveau...</option>
            {levels.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </GlassCard>

        {/* Navigation gestion */}
        {NAV_ITEMS.map(({ label, path }) => (
          <GlassCard
            key={path}
            className="p-4 cursor-pointer"
            onClick={() => navigate(path)}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-text-primary">{label}</span>
              <ChevronRight size={18} className="text-text-tertiary" />
            </div>
          </GlassCard>
        ))}

        {/* Vault path */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">
            Vault path (WebDAV)
          </h3>
          <input
            key={settings?.vaultPath}
            defaultValue={settings?.vaultPath ?? ''}
            onBlur={e => updateSettings.mutate({ vaultPath: e.target.value })}
            className={[
              'w-full h-12 px-4 rounded-md',
              'bg-black/[0.03] dark:bg-white/[0.04]',
              'border border-black/[0.08] dark:border-white/[0.06]',
              'text-text-primary font-mono text-sm',
              'focus:outline-none focus:border-accent/40',
            ].join(' ')}
            placeholder="/home/scrip/vault"
          />
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 : Créer frontend/src/pages/Settings/LevelsManager.jsx**

```jsx
// frontend/src/pages/Settings/LevelsManager.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';

export default function LevelsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: api.getLevels,
  });

  const create = useMutation({
    mutationFn: () => api.createLevel(newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['levels'] });
      setNewName('');
    },
  });

  const del = useMutation({
    mutationFn: api.deleteLevel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['levels'] }),
    onError: (e) => alert(e.message),
  });

  return (
    <div className="min-h-screen p-4">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Paramètres</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">Niveaux</h2>

      <div className="space-y-3 max-w-lg">
        {levels.map(level => (
          <GlassCard
            key={level.id}
            className="p-4 flex items-center justify-between"
          >
            <span className="text-[15px] text-text-primary">{level.name}</span>
            <button
              onClick={() => del.mutate(level.id)}
              className="text-status-danger p-1"
              aria-label={`Supprimer ${level.name}`}
            >
              <Trash2 size={16} />
            </button>
          </GlassCard>
        ))}

        {levels.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">
            Aucun niveau — ajoutez-en un ci-dessous.
          </p>
        )}

        {/* Formulaire ajout */}
        <GlassCard className="p-4 space-y-3">
          <Input
            label="Nouveau niveau"
            value={newName}
            onChange={setNewName}
            placeholder="ex : 1ère, Terminale, Terminale spé NSI"
          />
          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={!newName.trim() || create.isPending}
          >
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Étape 3 : Créer frontend/src/pages/Settings/SubjectsManager.jsx**

```jsx
// frontend/src/pages/Settings/SubjectsManager.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';

const PROMPT_OPTIONS = ['shs', 'svt', 'emc'];

const EMPTY_FORM = { name: '', levelId: '', prompt: 'shs', outputFolder: '' };

export default function SubjectsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterLevelId, setFilterLevelId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: api.getLevels,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', filterLevelId],
    queryFn: () => api.getSubjects(filterLevelId || undefined),
  });

  const create = useMutation({
    mutationFn: () => api.createSubject(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setForm(EMPTY_FORM);
    },
    onError: (e) => alert(e.message),
  });

  const del = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
    onError: (e) => alert(e.message),
  });

  const field = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const selectClass = [
    'w-full h-12 px-4 rounded-md',
    'bg-black/[0.03] dark:bg-white/[0.04]',
    'border border-black/[0.08] dark:border-white/[0.06]',
    'text-text-primary text-[15px]',
    'focus:outline-none',
  ].join(' ');

  return (
    <div className="min-h-screen p-4">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Paramètres</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">Matières</h2>

      <div className="space-y-3 max-w-lg">
        {/* Filtre par niveau */}
        <select
          value={filterLevelId}
          onChange={e => setFilterLevelId(e.target.value)}
          className={selectClass.replace('h-12', 'h-10').replace('text-[15px]', 'text-sm text-text-secondary')}
        >
          <option value="">Tous les niveaux</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        {/* Liste matières */}
        {subjects.map(s => {
          const level = levels.find(l => l.id === s.levelId);
          return (
            <GlassCard key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-text-primary truncate">
                  {s.name}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {level?.name ?? '—'} · prompt : {s.prompt} · {s.outputFolder}
                </p>
              </div>
              <button
                onClick={() => del.mutate(s.id)}
                className="text-status-danger p-1 shrink-0"
                aria-label={`Supprimer ${s.name}`}
              >
                <Trash2 size={16} />
              </button>
            </GlassCard>
          );
        })}

        {subjects.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-4">
            Aucune matière{filterLevelId ? ' pour ce niveau' : ''}.
          </p>
        )}

        {/* Formulaire création */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">
            Nouvelle matière
          </h3>

          <Input label="Nom" value={form.name} onChange={field('name')} placeholder="ex : Histoire" />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Niveau</label>
            <select value={form.levelId} onChange={e => field('levelId')(e.target.value)} className={selectClass}>
              <option value="">Choisir un niveau</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Prompt IA</label>
            <select value={form.prompt} onChange={e => field('prompt')(e.target.value)} className={selectClass}>
              {PROMPT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <Input
            label="Dossier de sortie"
            value={form.outputFolder}
            onChange={field('outputFolder')}
            placeholder="ex : Histoire (nom du dossier dans le vault)"
          />

          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={
              !form.name || !form.levelId || !form.outputFolder || create.isPending
            }
          >
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Étape 4 : Build de vérification**

```bash
cd frontend && npx vite build
```

Expected : build sans erreur.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/pages/
git commit -m "feat(frontend): add all pages (Home, Capture, Preview, Settings, Levels, Subjects)"
```

---

## Task 15 : PWA manifest

**Files:**
- Create: `frontend/public/manifest.json`
- Create: `frontend/public/icons/icon-192.png` (placeholder)
- Create: `frontend/public/icons/icon-512.png` (placeholder)

- [ ] **Étape 1 : Créer frontend/public/manifest.json**

```json
{
  "name": "Scrip",
  "short_name": "Scrip",
  "description": "Convertis tes cours manuscrits en notes Obsidian",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0A0B",
  "theme_color": "#0A0A0B",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Étape 2 : Créer des icônes placeholder**

Créer deux fichiers PNG valides (icônes violettes simples). Utiliser Node.js :

```bash
node -e "
const fs = require('fs');
// PNG 1x1 violet (#7C7AFF) encodé en base64
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.mkdirSync('frontend/public/icons', { recursive: true });
fs.writeFileSync('frontend/public/icons/icon-192.png', png);
fs.writeFileSync('frontend/public/icons/icon-512.png', png);
console.log('Icônes placeholder créées. Remplace-les par de vraies icônes 192x192 et 512x512.');
"
```

> **Note :** Ces icônes sont des placeholders 1×1px. Pour la production, remplace-les par de vraies icônes à la bonne résolution (outil recommandé : [realfavicongenerator.net](https://realfavicongenerator.net)).

- [ ] **Étape 3 : Commit**

```bash
git add frontend/public/manifest.json frontend/public/icons/
git commit -m "feat(frontend): add PWA manifest + placeholder icons"
```

---

## Task 16 : Déploiement (PM2 + Nginx + cron)

**Files:**
- Create: `ecosystem.config.js`
- Create: `nginx/scrip.conf`

- [ ] **Étape 1 : Créer ecosystem.config.js (racine du repo)**

```js
// ecosystem.config.js
export default {
  apps: [
    {
      name: 'scrip-backend',
      script: './backend/src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '300M',
      error_file: './logs/backend-error.log',
      out_file:   './logs/backend-out.log',
      merge_logs: true,
    },
    {
      name: 'scrip-webdav',
      // dufs doit être installé sur le VPS : voir étape 4
      script: 'dufs',
      args: '/home/scrip/vault --port 5005 --allow-all --auth "gabi:CHANGE_ME_STRONG_PASSWORD"',
      interpreter: 'none',
      error_file: './logs/webdav-error.log',
      out_file:   './logs/webdav-out.log',
    },
  ],
};
```

> **Important :** Remplacer `CHANGE_ME_STRONG_PASSWORD` par un vrai mot de passe avant de déployer. Ce mot de passe sera saisi dans Obsidian > Remotely Save > WebDAV.

- [ ] **Étape 2 : Créer nginx/scrip.conf**

```nginx
# nginx/scrip.conf
# Copier vers /etc/nginx/sites-available/scrip
# Puis : ln -s /etc/nginx/sites-available/scrip /etc/nginx/sites-enabled/

server {
    listen 443 ssl http2;
    server_name scrip.TONDOMAINE.FR;  # ← remplacer

    ssl_certificate     /etc/letsencrypt/live/scrip.TONDOMAINE.FR/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scrip.TONDOMAINE.FR/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # ── Frontend (fichiers Vite buildés) ─────────────────
    location / {
        root /home/scrip/app/frontend/dist;
        # IMPORTANT : renvoie index.html pour toutes les routes React Router
        try_files $uri $uri/ /index.html;

        # Cache long pour les assets hashés par Vite (ex: main-a1b2c3.js)
        location ~* \.(js|css|png|jpg|webp|woff2|ico)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ── Backend API ───────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Timeout long pour le pipeline IA (~40s max)
        proxy_read_timeout 120s;

        # Taille max upload photo (20MB)
        client_max_body_size 20m;
    }

    # ── WebDAV (sync Obsidian via dufs) ──────────────────
    location /vault/ {
        proxy_pass         http://127.0.0.1:5005/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;

        # Autoriser toutes les méthodes WebDAV (PROPFIND, MKCOL, etc.)
        proxy_pass_request_headers on;

        # Taille max sync (fichiers vault peuvent être grands)
        client_max_body_size 50m;
    }
}

# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name scrip.TONDOMAINE.FR;
    return 301 https://$host$request_uri;
}
```

- [ ] **Étape 3 : Créer le répertoire logs**

```bash
mkdir -p logs
echo "logs/" >> .gitignore
```

- [ ] **Étape 4 : Instructions de déploiement sur le VPS**

Exécuter ces commandes sur le VPS (via SSH) :

```bash
# 1. Installer Node.js 20 (si pas déjà fait)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Installer PM2 globalement
sudo npm install -g pm2

# 3. Installer dufs (WebDAV server)
curl -LO https://github.com/sigoden/dufs/releases/latest/download/dufs-v0.38.0-x86_64-unknown-linux-musl.tar.gz
tar xf dufs-v0.38.0-x86_64-unknown-linux-musl.tar.gz
sudo mv dufs /usr/local/bin/
dufs --version  # vérifier

# 4. Cloner le repo et installer les dépendances
sudo mkdir -p /home/scrip/app /home/scrip/vault /home/scrip/backups
cd /home/scrip/app
git clone https://github.com/TON_USER/Scrip.git .
npm install

# 5. Créer le .env backend
cat > /home/scrip/app/.env << 'EOF'
MISTRAL_API_KEY=ta_cle_mistral
OPENROUTER_API_KEY=ta_cle_openrouter
PORT=3001
DB_PATH=/home/scrip/app/backend/data/db.json
EOF

# 6. Builder le frontend
npm run build

# 7. Configurer Nginx
sudo cp /home/scrip/app/nginx/scrip.conf /etc/nginx/sites-available/scrip
# Éditer le fichier pour remplacer TONDOMAINE.FR
sudo nano /etc/nginx/sites-available/scrip
sudo ln -s /etc/nginx/sites-available/scrip /etc/nginx/sites-enabled/
sudo nginx -t  # vérifier la config

# 8. Obtenir le certificat SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d scrip.TONDOMAINE.FR
sudo nginx -t && sudo systemctl reload nginx

# 9. Démarrer PM2
cd /home/scrip/app
# Éditer ecosystem.config.js pour mettre le vrai mot de passe WebDAV
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # suivre les instructions affichées pour le boot automatique

# 10. Vérifier que tout tourne
pm2 status
curl https://scrip.TONDOMAINE.FR/api/settings
```

- [ ] **Étape 5 : Configurer le cron de backup**

Sur le VPS :

```bash
crontab -e
```

Ajouter ces deux lignes :

```bash
# Backup quotidien du vault à 3h du matin
0 3 * * * zip -r /home/scrip/backups/vault-$(date +\%Y\%m\%d).zip /home/scrip/vault/ >> /home/scrip/backups/backup.log 2>&1

# Supprimer les backups de plus de 30 jours
5 3 * * * find /home/scrip/backups/ -name "vault-*.zip" -mtime +30 -delete
```

(La suppression 5 minutes après la création garantit que le backup du jour est créé avant la purge.)

- [ ] **Étape 6 : Commit**

```bash
git add ecosystem.config.js nginx/scrip.conf .gitignore
git commit -m "feat: add PM2 ecosystem config + Nginx config + deployment instructions"
```

---

## Self-review du plan

### Couverture spec

| Exigence spec | Task |
|---------------|------|
| Monorepo npm workspaces | Task 1 |
| Migration src/ → backend/src/pipeline/ | Task 2 |
| lowdb db.json | Task 3 |
| parseMetadata (nouveau) | Task 2 + Task 3 tests |
| GET/PUT /api/settings | Task 4 |
| CRUD /api/levels | Task 4 |
| CRUD /api/subjects | Task 5 |
| CRUD + PATCH /api/notes | Task 5 |
| POST /api/ingest | Task 6 |
| Vite + Tailwind + tokens CSS | Task 7 |
| Composants base (GlassCard etc.) | Task 8 |
| Système thème dark/light/auto + anti-FOUC | Task 9 |
| React Router v6 (6 routes) | Task 10 |
| api.js client HTTP | Task 10 |
| Page Home | Task 11 |
| Page Capture + useCamera | Task 12 |
| Page Preview (render + édition) | Task 13 |
| Page Settings + LevelsManager + SubjectsManager | Task 14 |
| PWA manifest | Task 15 |
| PM2 + Nginx + cron backup + auto-delete | Task 16 |

Toutes les exigences couvertes. ✅

### Consistance des signatures

- `api.ingest(photo, subjectId, levelId)` → POST /api/ingest avec FormData ✅
- `api.patchNote(id, markdown)` → body `{ markdown }` → notes.js attend `req.body.markdown` ✅
- `db.data.subjects[].prompt` → passé à `structureContent(rawMarkdown, subject.prompt, ...)` → PROMPTS['shs'] existe ✅
- `parseMetadata` exportée depuis `audit.js` → importée dans `ingest.js` route ✅

### Placeholders

Aucun TBD ni TODO dans le code. Les seuls "à remplacer" sont des valeurs de config (domaine, mot de passe WebDAV) documentés avec des commentaires explicites. ✅
