# WebDAV Obsidian Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose le vault local de Scrip en WebDAV depuis Express, protégé par basic auth bcrypt, pour qu'Obsidian (Remotely Save) puisse s'y connecter en HTTPS.

**Architecture:** Un middleware Express monté à `/webdav` vérifie l'activation + les credentials avant de déléguer au serveur WebDAV (`webdav-server`) qui expose le dossier vault en lecture/écriture. Les credentials sont stockés dans `db.data.settings.webdav` avec le mot de passe haché via bcryptjs. Le frontend expose une section de configuration dans les Paramètres.

**Tech Stack:** `webdav-server` (protocole WebDAV), `bcryptjs` (hash password, pure JS), Express middleware, lowdb, React Query + Tailwind (frontend).

---

## File Map

| Fichier | Action | Rôle |
|---|---|---|
| `backend/src/webdav.js` | Créer | Middleware WebDAV : auth + serveur WebDAV |
| `backend/src/db.js` | Modifier | Ajouter `webdav` + `publicUrl` aux defaults |
| `backend/src/routes/settings.js` | Modifier | GET masque `passwordHash`, PUT hash le password |
| `backend/src/app.js` | Modifier | Monter `/webdav` middleware |
| `backend/tests/webdav.test.js` | Créer | Tests unitaires auth middleware |
| `frontend/src/pages/Settings/index.jsx` | Modifier | Section "Obsidian WebDAV" |

---

### Task 1 : Installer les packages backend

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1 : Installer webdav-server et bcryptjs**

```bash
cd backend
npm install webdav-server bcryptjs
```

Expected output : `added X packages` sans erreur.

- [ ] **Step 2 : Vérifier les imports ESM (test rapide)**

```bash
node --input-type=module <<'EOF'
import webdavPkg from 'webdav-server';
import bcrypt from 'bcryptjs';
const { v2: webdav } = webdavPkg;
console.log('OK', typeof webdav.WebDAVServer, typeof bcrypt.hash);
EOF
```

Expected : `OK function function`

- [ ] **Step 3 : Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add webdav-server and bcryptjs"
```

---

### Task 2 : Étendre les settings dans db.js

**Files:**
- Modify: `backend/src/db.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `backend/tests/webdav.test.js` (créer le fichier) :

```js
// backend/tests/webdav.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDb = path.join(os.tmpdir(), `scrip-webdav-test-${Date.now()}.json`);
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../src/db.js');

before(async () => { await initDb(); });
after(() => { if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb); });

test('db.data.settings a webdav et publicUrl par défaut', async () => {
  assert.deepEqual(db.data.settings.webdav, {
    enabled: false,
    username: 'scrip',
    passwordHash: null,
  });
  assert.equal(db.data.settings.publicUrl, '');
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd backend
node --test tests/webdav.test.js
```

Expected : FAIL — `webdav` ou `publicUrl` undefined.

- [ ] **Step 3 : Modifier `backend/src/db.js`**

Remplacer le bloc `DEFAULT_DATA` et la fonction `initDb` :

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
    vaultPath: path.join(__dirname, '../../vault'),
    currentLevelId: null,
    publicUrl: '',
    webdav: {
      enabled: false,
      username: 'scrip',
      passwordHash: null,
    },
  },
  levels: [],
  subjects: [],
  notes: [],
};

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../data/db.json');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const adapter = new JSONFile(DB_PATH);
export const db = new Low(adapter, DEFAULT_DATA);

export async function initDb() {
  await db.read();
  db.data = {
    settings: {
      ...DEFAULT_DATA.settings,
      ...db.data.settings,
      // Deep merge webdav pour ne pas perdre les champs existants
      webdav: {
        ...DEFAULT_DATA.settings.webdav,
        ...(db.data.settings.webdav ?? {}),
      },
    },
    levels:   db.data.levels   ?? [],
    subjects: db.data.subjects ?? [],
    notes:    db.data.notes    ?? [],
  };
  await db.write();
}
```

- [ ] **Step 4 : Relancer le test**

```bash
node --test tests/webdav.test.js
```

Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/db.js backend/tests/webdav.test.js
git commit -m "feat: add webdav + publicUrl settings to db defaults"
```

---

### Task 3 : Mettre à jour la route settings

**Files:**
- Modify: `backend/src/routes/settings.js`

- [ ] **Step 1 : Ajouter les tests dans webdav.test.js**

Ajouter à la fin de `backend/tests/webdav.test.js` :

```js
const { default: supertest } = await import('supertest');
const { createApp } = await import('../src/app.js');

const request = supertest(createApp());

test('GET /api/settings ne renvoie pas passwordHash', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 200);
  assert.ok('webdav' in res.body, 'webdav doit être présent');
  assert.ok(!('passwordHash' in res.body.webdav), 'passwordHash ne doit pas être exposé');
  assert.equal(res.body.webdav.enabled, false);
  assert.equal(res.body.webdav.username, 'scrip');
});

test('PUT /api/settings webdav.password est haché et non renvoyé', async () => {
  const res = await request.put('/api/settings').send({
    webdav: { enabled: true, username: 'gabi', password: 'monmotdepasse' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.webdav.enabled, true);
  assert.equal(res.body.webdav.username, 'gabi');
  assert.ok(!('passwordHash' in res.body.webdav));
  assert.ok(!('password' in res.body.webdav));
});

test('PUT /api/settings publicUrl est accepté', async () => {
  const res = await request.put('/api/settings').send({
    publicUrl: 'https://scrip.example.com',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.publicUrl, 'https://scrip.example.com');
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
node --test tests/webdav.test.js
```

Expected : 3 nouveaux tests FAIL.

- [ ] **Step 3 : Réécrire `backend/src/routes/settings.js`**

```js
// backend/src/routes/settings.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

export const settingsRouter = Router();

/** Retire passwordHash de l'objet settings avant de l'envoyer au client */
function sanitize(settings) {
  const { webdav: { passwordHash, ...webdavPublic } = {}, ...rest } = settings;
  return { ...rest, webdav: webdavPublic };
}

settingsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(sanitize(db.data.settings));
});

settingsRouter.put('/', async (req, res) => {
  await db.read();

  const scalarFields = ['theme', 'vaultPath', 'currentLevelId', 'publicUrl'];
  for (const key of scalarFields) {
    if (req.body[key] !== undefined) db.data.settings[key] = req.body[key];
  }

  if (req.body.webdav) {
    const { enabled, username, password } = req.body.webdav;
    if (enabled !== undefined) db.data.settings.webdav.enabled = Boolean(enabled);
    if (username !== undefined) db.data.settings.webdav.username = String(username).trim();
    if (password) {
      db.data.settings.webdav.passwordHash = await bcrypt.hash(String(password), 10);
    }
  }

  await db.write();
  res.json(sanitize(db.data.settings));
});
```

- [ ] **Step 4 : Relancer les tests**

```bash
node --test tests/webdav.test.js
```

Expected : tous PASS.

- [ ] **Step 5 : Vérifier que les tests existants passent toujours**

```bash
node --test tests/routes.test.js
```

Expected : tous PASS.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/routes/settings.js backend/tests/webdav.test.js
git commit -m "feat: settings route handles webdav config + bcrypt hash"
```

---

### Task 4 : Créer le middleware WebDAV

**Files:**
- Create: `backend/src/webdav.js`

- [ ] **Step 1 : Ajouter les tests auth dans webdav.test.js**

Ajouter à la fin de `backend/tests/webdav.test.js` :

```js
// S'assure que le vault tmp existe pour le serveur WebDAV
const tmpVault = path.join(os.tmpdir(), `scrip-vault-${Date.now()}`);
fs.mkdirSync(tmpVault, { recursive: true });

// Configure les settings : webdav activé, password connu
before(async () => {
  await request.put('/api/settings').send({
    webdav: { enabled: true, username: 'testuser', password: 'testpass' },
    vaultPath: tmpVault,
  });
});

after(() => { fs.rmSync(tmpVault, { recursive: true, force: true }); });

test('GET /webdav sans auth → 401', async () => {
  const res = await request.get('/webdav/');
  assert.equal(res.status, 401);
  assert.ok(res.headers['www-authenticate']?.includes('Basic'));
});

test('GET /webdav avec mauvais password → 401', async () => {
  const creds = Buffer.from('testuser:mauvaispass').toString('base64');
  const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
  assert.equal(res.status, 401);
});

test('GET /webdav avec bons credentials → pas 401/503', async () => {
  const creds = Buffer.from('testuser:testpass').toString('base64');
  const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
  // Le serveur WebDAV répond 207 (PROPFIND) ou 200/301 selon le verbe
  assert.notEqual(res.status, 401);
  assert.notEqual(res.status, 503);
});

test('GET /webdav quand désactivé → 503', async () => {
  await request.put('/api/settings').send({ webdav: { enabled: false } });
  const creds = Buffer.from('testuser:testpass').toString('base64');
  const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
  assert.equal(res.status, 503);
  // Réactiver pour les tests suivants
  await request.put('/api/settings').send({ webdav: { enabled: true } });
});
```

- [ ] **Step 2 : Lancer les tests — ils doivent échouer (route /webdav introuvable)**

```bash
node --test tests/webdav.test.js
```

Expected : les 4 nouveaux tests FAIL avec 404 ou connexion refusée.

- [ ] **Step 3 : Créer `backend/src/webdav.js`**

```js
// backend/src/webdav.js
import webdavPkg from 'webdav-server';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const { v2: webdav } = webdavPkg;

// Cache du serveur WebDAV — recréé si vaultPath change
let _server = null;
let _vaultPath = null;

/**
 * Retourne (et met en cache) le WebDAVServer pour le vaultPath donné.
 * Si vaultPath a changé, recrée le serveur.
 */
async function getWebdavServer(vaultPath) {
  if (_server && _vaultPath === vaultPath) return _server;

  const server = new webdav.WebDAVServer();
  await new Promise((resolve, reject) => {
    server.setFileSystem('/', new webdav.PhysicalFileSystem(vaultPath), (success) => {
      if (success) resolve();
      else reject(new Error(`WebDAV: impossible de monter le filesystem ${vaultPath}`));
    });
  });

  _server = server;
  _vaultPath = vaultPath;
  return server;
}

/**
 * Retourne un middleware Express qui :
 * 1. Vérifie que WebDAV est activé (sinon 503)
 * 2. Vérifie la basic auth (sinon 401)
 * 3. Délègue au serveur WebDAV
 */
export function createWebdavMiddleware() {
  return async (req, res, next) => {
    try {
      await db.read();
      const { webdav: cfg, vaultPath } = db.data.settings;

      // 1. Vérification activation
      if (!cfg?.enabled) {
        return res.status(503).json({ error: 'WebDAV désactivé dans les paramètres Scrip' });
      }

      // 2. Basic auth
      const authHeader = req.headers['authorization'] ?? '';
      if (!authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
        return res.status(401).end('Authentification requise');
      }

      const decoded  = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      const username = decoded.slice(0, colonIdx);
      const password = decoded.slice(colonIdx + 1);

      const usernameOk = cfg.username === username;
      const passwordOk = cfg.passwordHash
        ? await bcrypt.compare(password, cfg.passwordHash)
        : false;

      if (!usernameOk || !passwordOk) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
        return res.status(401).end('Identifiants incorrects');
      }

      // 3. Servir le WebDAV
      const server = await getWebdavServer(vaultPath);
      webdav.extensions.express('/', server)(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 4 : Relancer les tests**

```bash
node --test tests/webdav.test.js
```

Expected : tous PASS (y compris les 4 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add backend/src/webdav.js backend/tests/webdav.test.js
git commit -m "feat: WebDAV middleware with basic auth and vault filesystem"
```

---

### Task 5 : Monter WebDAV dans app.js

**Files:**
- Modify: `backend/src/app.js`

- [ ] **Step 1 : Modifier `backend/src/app.js`**

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
import { createWebdavMiddleware } from './webdav.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? false
      : 'http://localhost:5000',
  }));
  app.use(express.json());

  app.use('/api/settings', settingsRouter);
  app.use('/api/levels',   levelsRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/notes',    notesRouter);
  app.use('/api/ingest',   ingestRouter);

  // WebDAV — monté APRÈS les routes /api pour éviter les conflits
  app.use('/webdav', createWebdavMiddleware());

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 2 : Lancer tous les tests**

```bash
cd backend
node --test tests/routes.test.js tests/webdav.test.js
```

Expected : tous PASS.

- [ ] **Step 3 : Démarrer le serveur et tester manuellement**

```bash
npm run dev
```

Dans un autre terminal :
```bash
# Sans auth → doit retourner 401
curl -v http://localhost:5001/webdav/

# WebDAV désactivé (défaut) → doit retourner 503
curl -v http://localhost:5001/webdav/
```

- [ ] **Step 4 : Commit**

```bash
git add backend/src/app.js
git commit -m "feat: mount WebDAV middleware at /webdav"
```

---

### Task 6 : Interface WebDAV dans les Paramètres

**Files:**
- Modify: `frontend/src/pages/Settings/index.jsx`

- [ ] **Step 1 : Mettre à jour `frontend/src/pages/Settings/index.jsx`**

Remplacer le fichier entier :

```jsx
// frontend/src/pages/Settings/index.jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import Dropdown from '../../components/Dropdown.jsx';

const NAV_ITEMS = [
  { label: 'Gérer les niveaux',  path: '/settings/levels' },
  { label: 'Gérer les matières', path: '/settings/subjects' },
];

/** Copie du texte dans le presse-papiers avec feedback visuel */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={doCopy}
      className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/70 transition-colors"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  );
}

/** Génère un mot de passe aléatoire de 16 caractères */
function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: levels = [] } = useQuery({ queryKey: ['levels'], queryFn: api.getLevels });

  const updateSettings = useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  // ── WebDAV local state ──────────────────────────────────────────────────────
  const [publicUrl,    setPublicUrl]    = useState('');
  const [webdavUser,   setWebdavUser]   = useState('scrip');
  const [webdavPass,   setWebdavPass]   = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [webdavSaved,  setWebdavSaved]  = useState(false);

  // Sync depuis les settings chargés
  useEffect(() => {
    if (!settings) return;
    if (settings.publicUrl)          setPublicUrl(settings.publicUrl);
    if (settings.webdav?.username)   setWebdavUser(settings.webdav.username);
  }, [settings]);

  const webdavEnabled = settings?.webdav?.enabled ?? false;
  const webdavUrl     = publicUrl ? `${publicUrl.replace(/\/$/, '')}/webdav` : null;

  const nginxSnippet = `location /webdav/ {
    proxy_pass http://localhost:5001/webdav/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 10M;
}`;

  function toggleWebdav() {
    updateSettings.mutate({ webdav: { enabled: !webdavEnabled } });
  }

  function saveWebdav() {
    updateSettings.mutate({
      publicUrl,
      webdav: {
        username: webdavUser,
        ...(webdavPass ? { password: webdavPass } : {}),
      },
    }, {
      onSuccess: () => {
        setWebdavPass('');
        setWebdavSaved(true);
        setTimeout(() => setWebdavSaved(false), 2000);
      },
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Paramètres</h1>
      </div>

      <div className="space-y-4">
        {/* Thème — mobile only */}
        <div className="md:hidden">
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Thème</h3>
            <ThemeToggle />
          </GlassCard>
        </div>

        {/* Niveau courant */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Niveau actuel</h3>
          <Dropdown
            value={settings?.currentLevelId ?? ''}
            onChange={v => updateSettings.mutate({ currentLevelId: v })}
            options={levels.map(l => ({ value: l.id, label: l.name }))}
            placeholder="Choisir un niveau…"
            fullWidth
            className="h-12 px-4 rounded-md text-[15px]
              bg-black/[0.03] dark:bg-white/[0.04]
              border border-black/[0.08] dark:border-white/[0.06]
              text-text-primary"
          />
        </GlassCard>

        {/* Navigation */}
        {NAV_ITEMS.map(({ label, path }) => (
          <GlassCard key={path} className="p-4 cursor-pointer" onClick={() => navigate(path)}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-text-primary">{label}</span>
              <ChevronRight size={18} className="text-text-tertiary" />
            </div>
          </GlassCard>
        ))}

        {/* Vault path */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Vault path</h3>
          <input
            key={settings?.vaultPath}
            defaultValue={settings?.vaultPath ?? ''}
            onBlur={e => updateSettings.mutate({ vaultPath: e.target.value })}
            className="w-full h-12 px-4 rounded-md text-sm font-mono
              bg-black/[0.03] dark:bg-white/[0.04]
              border border-black/[0.08] dark:border-white/[0.06]
              text-text-primary focus:outline-none focus:border-accent/50"
            placeholder="/home/scrip/vault"
          />
        </GlassCard>

        {/* ── Obsidian WebDAV ────────────────────────────────────────────────── */}
        <GlassCard className="p-4 space-y-4">
          {/* Header + toggle */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Obsidian WebDAV</h3>
            <button
              onClick={toggleWebdav}
              className={[
                'relative w-10 h-5 rounded-full transition-colors duration-200',
                webdavEnabled ? 'bg-accent' : 'bg-black/[0.12] dark:bg-white/[0.15]',
              ].join(' ')}
              aria-label={webdavEnabled ? 'Désactiver WebDAV' : 'Activer WebDAV'}
            >
              <span className={[
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                webdavEnabled ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')} />
            </button>
          </div>

          {/* URL publique */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              URL publique du serveur
            </label>
            <input
              type="text"
              value={publicUrl}
              onChange={e => setPublicUrl(e.target.value)}
              placeholder="https://scrip.mondomaine.com"
              className="w-full h-10 px-3 rounded-lg text-[13px] font-mono
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.08] dark:border-white/[0.07]
                text-text-primary placeholder:text-text-tertiary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Identifiant
            </label>
            <input
              type="text"
              value={webdavUser}
              onChange={e => setWebdavUser(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-[13px]
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.08] dark:border-white/[0.07]
                text-text-primary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Mot de passe {settings?.webdav?.passwordHash === null ? '' : '(laisser vide pour ne pas changer)'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={webdavPass}
                  onChange={e => setWebdavPass(e.target.value)}
                  placeholder={settings?.webdav?.passwordHash ? '••••••••••••••••' : 'Définir un mot de passe'}
                  className="w-full h-10 px-3 pr-9 rounded-lg text-[13px]
                    bg-black/[0.04] dark:bg-white/[0.05]
                    border border-black/[0.08] dark:border-white/[0.07]
                    text-text-primary placeholder:text-text-tertiary
                    focus:outline-none focus:border-accent/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setWebdavPass(generatePassword()); setShowPass(true); }}
                className="h-10 px-3 rounded-lg text-[12px] font-medium
                  bg-black/[0.05] dark:bg-white/[0.07]
                  text-text-secondary hover:text-text-primary
                  hover:bg-black/[0.09] dark:hover:bg-white/[0.11]
                  transition-colors whitespace-nowrap"
              >
                Générer
              </button>
            </div>
          </div>

          {/* Bouton enregistrer */}
          <button
            onClick={saveWebdav}
            disabled={updateSettings.isPending}
            className="w-full h-10 rounded-lg text-[13px] font-medium
              bg-accent text-white hover:bg-accent/90
              disabled:opacity-40 transition-colors"
          >
            {webdavSaved ? '✓ Enregistré' : updateSettings.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          {/* URL WebDAV à copier dans Obsidian */}
          {webdavEnabled && webdavUrl && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                URL à coller dans Remotely Save
              </p>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                bg-black/[0.03] dark:bg-white/[0.04]
                border border-black/[0.06] dark:border-white/[0.05]">
                <code className="text-[12px] text-accent truncate">{webdavUrl}</code>
                <CopyButton text={webdavUrl} />
              </div>
            </div>
          )}

          {/* Snippet Nginx */}
          <details className="group">
            <summary className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium cursor-pointer select-none hover:text-text-secondary transition-colors">
              Config Nginx ▸
            </summary>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-tertiary">Ajouter dans ton bloc <code className="text-accent">server {'{}'}</code> :</p>
                <CopyButton text={nginxSnippet} />
              </div>
              <pre className="text-[11px] leading-relaxed p-3 rounded-lg overflow-x-auto
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.06] dark:border-white/[0.05]
                text-text-secondary font-mono">
                {nginxSnippet}
              </pre>
            </div>
          </details>

          {/* Guide Remotely Save */}
          <details className="group">
            <summary className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium cursor-pointer select-none hover:text-text-secondary transition-colors">
              Guide Obsidian Remotely Save ▸
            </summary>
            <ol className="mt-2 space-y-1.5 text-[12px] text-text-secondary list-decimal list-inside">
              <li>Installe le plugin <strong>Remotely Save</strong> dans Obsidian (Paramètres → Plugins tiers)</li>
              <li>Dans le plugin : choisir <strong>WebDAV</strong>, coller l'URL ci-dessus</li>
              <li>Entrer l'identifiant et le mot de passe configurés ici, puis cliquer <strong>Test</strong></li>
              <li>Lancer une première synchronisation manuelle</li>
            </ol>
          </details>
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier visuellement dans le navigateur**

```bash
# Frontend (depuis la racine du repo)
cd frontend && npm run dev
```

Aller sur `http://localhost:5000/settings` et vérifier :
- La section "Obsidian WebDAV" apparaît
- Le toggle fonctionne
- Le bouton "Générer" génère un mot de passe visible
- Le bouton "Enregistrer" sauvegarde sans erreur console
- L'URL WebDAV s'affiche si `publicUrl` est renseigné et WebDAV activé
- Le snippet Nginx s'affiche dans le `<details>`

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/pages/Settings/index.jsx
git commit -m "feat: WebDAV settings section in UI"
```

---

### Task 7 : Test end-to-end manuel

**Files:** aucun — validation manuelle

- [ ] **Step 1 : Démarrer le backend**

```bash
cd backend && npm run dev
```

- [ ] **Step 2 : Activer WebDAV via l'UI et configurer un mot de passe**

Aller dans Paramètres → Obsidian WebDAV → activer + définir mdp → Enregistrer.

- [ ] **Step 3 : Tester PROPFIND avec curl (simule Obsidian)**

```bash
# Remplacer user:pass par tes credentials
curl -v --user scrip:tonmotdepasse -X PROPFIND \
  -H "Depth: 1" \
  http://localhost:5001/webdav/
```

Expected : réponse `207 Multi-Status` avec XML listant le contenu du vault.

- [ ] **Step 4 : Tester PUT (créer un fichier)**

```bash
curl -v --user scrip:tonmotdepasse -X PUT \
  -H "Content-Type: text/plain" \
  --data "# Test WebDAV" \
  http://localhost:5001/webdav/test-webdav.md
```

Expected : `201 Created`. Vérifier que `vault/test-webdav.md` existe sur le disque.

- [ ] **Step 5 : Nettoyer le fichier de test**

```bash
rm vault/test-webdav.md
```

- [ ] **Step 6 : Commit final**

```bash
git add -A
git commit -m "feat: WebDAV Obsidian sync complete"
```

---

## Notes de déploiement Debian

Après déploiement, ajouter dans le bloc `server {}` Nginx (avant ou après les autres `location`) :

```nginx
location /webdav/ {
    proxy_pass http://localhost:5001/webdav/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 10M;
}
```

Puis `nginx -t && systemctl reload nginx`.

Dans Obsidian → Remotely Save → WebDAV :
- **URL :** `https://scrip.mondomaine.com/webdav`
- **Username / Password :** ceux configurés dans Scrip
- Cliquer **Test** → doit afficher "success"
