# Scrip — Design Frontend + Backend

> **Date** : 2026-05-13
> **Statut** : validé, prêt pour implémentation
> **Scope** : backend Express + frontend React PWA + déploiement VPS

---

## 1. Contexte

Le pipeline CLI (`ingest.js`) est fonctionnel. Ce document spécifie l'architecture complète pour exposer ce pipeline via une interface web mobile-first (PWA) et une API HTTP, déployée sur un VPS Contabo Debian 12.

Stack verrouillée (CDC) : React, Tailwind CSS, Motion, lucide-react, Node.js/Express, Nginx, PM2, dufs (WebDAV).

---

## 2. Monorepo — structure globale

```
Scrip/                          ← racine npm workspaces
├── backend/
│   ├── src/
│   │   ├── pipeline/           ← src/ actuel migré ici (ocr, structure, format, audit)
│   │   ├── routes/             ← endpoints API Express
│   │   ├── middleware/         ← multer (upload), errors
│   │   └── server.js           ← point d'entrée Express
│   ├── prompts/                ← prompts/ actuel migré ici
│   ├── data/
│   │   └── db.json             ← base de données lowdb (notes, niveaux, matières, settings)
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   ├── manifest.json       ← PWA manifest (installable sur iOS/Android)
│   │   └── icons/              ← icônes 192px et 512px
│   ├── src/
│   │   ├── pages/              ← une page = un fichier
│   │   │   ├── Home.jsx
│   │   │   ├── Capture.jsx
│   │   │   ├── Preview.jsx
│   │   │   └── Settings/
│   │   │       ├── index.jsx
│   │   │       ├── LevelsManager.jsx
│   │   │       └── SubjectsManager.jsx
│   │   ├── components/         ← briques réutilisables
│   │   │   ├── GlassCard.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── FAB.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── BottomSheet.jsx
│   │   │   ├── NoteCard.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── hooks/
│   │   │   ├── useTheme.js
│   │   │   └── useCamera.js
│   │   ├── lib/
│   │   │   └── api.js          ← toutes les fonctions fetch vers /api/*
│   │   ├── app.css             ← CSS variables dark/light (tokens CDC §12)
│   │   ├── App.jsx             ← routing React Router v6
│   │   └── main.jsx            ← entry point
│   ├── index.html              ← contient script anti-flash thème (inline, avant React)
│   ├── vite.config.js
│   └── package.json
│
├── ingest.js                   ← CLI conservé, importe depuis ./backend/src/pipeline/
├── package.json                ← racine workspaces
├── ecosystem.config.js         ← config PM2
└── docs/
```

### Migration des modules existants

| Avant | Après |
|-------|-------|
| `src/ocr.js` | `backend/src/pipeline/ocr.js` |
| `src/structure.js` | `backend/src/pipeline/structure.js` |
| `src/format.js` | `backend/src/pipeline/format.js` |
| `src/audit.js` | `backend/src/pipeline/audit.js` |
| `prompts/shs.js` | `backend/prompts/shs.js` |
| `tests/*.test.js` | `tests/*.test.js` (inchangé, chemins d'import mis à jour) |

`ingest.js` continue de fonctionner, ses imports sont mis à jour vers `./backend/src/pipeline/`.

---

## 3. Base de données — lowdb + db.json

**Choix : lowdb v7** (ESM natif, zéro dépendance transitive, JSON lisible/versionnable).

### Schéma de `backend/data/db.json`

```json
{
  "settings": {
    "theme": "auto",
    "vaultPath": "/home/scrip/vault",
    "currentLevelId": "1ere"
  },
  "levels": [
    { "id": "1ere", "name": "1ère" }
  ],
  "subjects": [
    {
      "id": "histoire",
      "name": "Histoire",
      "levelId": "1ere",
      "prompt": "shs",
      "outputFolder": "Histoire"
    }
  ],
  "notes": [
    {
      "id": "uuid-v4",
      "title": "La Révolution française",
      "subjectId": "histoire",
      "levelId": "1ere",
      "path": "/home/scrip/vault/1ère/Histoire/La Révolution française.md",
      "auditPath": null,
      "createdAt": "2026-05-13T18:00:00.000Z",
      "metadata": {
        "qualite_francais": 75,
        "nb_fautes_orthographe": 10,
        "nb_fautes_grammaire": 8,
        "nb_fautes_syntaxe": 5,
        "commentaire": "..."
      }
    }
  ]
}
```

**Clés API** (`MISTRAL_API_KEY`, `OPENROUTER_API_KEY`) : stockées uniquement dans `.env` côté serveur, jamais dans `db.json`, jamais envoyées au frontend.

---

## 4. API Backend — endpoints

### Ingestion

```
POST /api/ingest
  Content-Type: multipart/form-data
  Body: photo (fichier), subjectId (string), levelId (string, optionnel)
  → pipeline runOCR → structureContent → buildNote → writeAuditLog
  → sauvegarde .md sur disque dans vault/
  → insère note dans db.json
  → retourne { note: {...}, markdown: "..." }
```

### Notes

```
GET    /api/notes              → liste toutes les notes (triées par date desc)
GET    /api/notes/:id          → détail d'une note + markdown du fichier .md
PATCH  /api/notes/:id          → édite le markdown : body { markdown }
                                  réécrit le .md sur disque + met à jour db
DELETE /api/notes/:id          → supprime note de db + fichier .md du disque
```

### Niveaux

```
GET    /api/levels             → liste tous les niveaux
POST   /api/levels             → crée un niveau : body { name }
PATCH  /api/levels/:id         → renomme : body { name }
DELETE /api/levels/:id         → refuse si des matières sont liées (409 + message)
```

### Matières

```
GET    /api/subjects           → liste toutes les matières (?levelId= pour filtrer)
POST   /api/subjects           → crée : body { name, levelId, prompt, outputFolder }
PATCH  /api/subjects/:id       → met à jour la config : body partiel accepté
DELETE /api/subjects/:id       → refuse si des notes sont liées (409 + message)
```

### Settings

```
GET    /api/settings           → retourne settings (sans clés API)
PUT    /api/settings           → met à jour : body { theme?, vaultPath?, currentLevelId? }
```

---

## 5. Frontend — pages et routing

### React Router v6

```
/                       → Home       (liste cours récents)
/capture                → Capture    (photo + choix matière/niveau)
/preview/:noteId        → Preview    (markdown rendu post-ingestion, actions)
/settings               → Settings   (config globale + thème)
/settings/levels        → LevelsManager   (CRUD niveaux)
/settings/subjects      → SubjectsManager (CRUD matières + config par matière)
```

### Pages

**Home**
- Liste de `NoteCard` (titre, matière, date, score qualité)
- Header glass sticky (blur au scroll)
- FAB `Camera` centré en bas

**Capture**
- `<input type="file" accept="image/*" capture="environment">` (caméra native iOS/Android)
- Sélecteur matière (dropdown ou segmented) + niveau pré-rempli depuis settings
- Bouton "Ingérer" → POST /api/ingest → redirect vers /preview/:id
- État de chargement pendant le pipeline (~20-40s)

**Preview**
- Markdown rendu (bibliothèque `react-markdown`)
- Header glass collant : actions Valider / Éditer / Supprimer
- Mode édition : textarea plein écran → PATCH /api/notes/:id

**Settings**
- Segmented control thème : Sombre / Clair / Auto (icônes Moon/Sun/Monitor)
- Niveau courant (sélecteur parmi les niveaux créés)
- Liens vers LevelsManager et SubjectsManager
- Vault path (input texte)

**LevelsManager**
- Liste des niveaux avec rename inline et suppression
- Input + bouton "Ajouter un niveau"

**SubjectsManager**
- Filtre par niveau
- Liste des matières : nom, dossier de sortie, prompt associé
- Formulaire création/édition

### Composants réutilisables

| Composant | Rôle |
|-----------|------|
| `GlassCard` | Conteneur frosted glass (voir tokens CDC §12) |
| `Button` | Bouton primaire/secondaire/danger, height 56px |
| `FAB` | Bouton circulaire 72px, bottom-center |
| `Input` | Champ texte avec focus ring accent |
| `BottomSheet` | Sheet qui monte du bas, radius-xl en haut |
| `NoteCard` | Carte d'un cours dans Home |
| `ThemeToggle` | Segmented control 3 options |

### Gestion d'état

| Couche | Outil | Pourquoi |
|--------|-------|---------|
| Données serveur | TanStack Query v5 | Cache, loading states, invalidation automatique |
| Thème global | React Context | Simple, pas besoin de store externe |
| État formulaires | `useState` local | Pas de formulaires complexes |

---

## 6. Système de thème

### Prévention du flash (FOUC)

Script inline dans `<head>` de `index.html`, exécuté **avant** React :

```html
<script>
  const s = localStorage.getItem('scrip.theme')
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (s === 'dark' || (s === 'auto' && dark) || (!s && dark)) {
    document.documentElement.classList.add('dark')
  }
</script>
```

### Tokens CSS (app.css)

Variables RGB (sans les canaux alpha) pour compatibilité Tailwind `/ <alpha-value>` :

```css
:root {
  --bg-base: 250 250 251;
  --bg-elevated: 255 255 255;
  --text-primary: 10 10 11;
  --text-secondary: 90 90 96;
  --text-tertiary: 154 154 160;
  --accent: 110 108 232;
  --success: 43 165 111;
  --warning: 185 122 28;
  --danger: 201 69 69;
}
.dark {
  --bg-base: 10 10 11;
  --bg-elevated: 20 20 22;
  --text-primary: 236 236 238;
  --text-secondary: 154 154 160;
  --text-tertiary: 90 90 96;
  --accent: 124 122 255;
  --success: 94 224 168;
  --warning: 245 194 107;
  --danger: 244 114 114;
}
```

Tailwind config : `darkMode: 'class'`. Bascule via classe `.dark` sur `<html>`.

Transition smooth : `transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease`

---

## 7. Déploiement VPS

### Processus actifs

| Processus | Port | Géré par |
|-----------|------|----------|
| Nginx | 80, 443 | systemd |
| Express (backend) | 3001 | PM2 |
| dufs (WebDAV) | 5005 | PM2 |

### Structure sur le VPS

```
/home/scrip/
├── app/          ← repo git cloné
├── vault/        ← notes .md générées (servi par dufs)
│   └── 1ère/
│       └── Histoire/
└── backups/      ← archives zip quotidiennes
```

### Config Nginx

- HTTPS via Let's Encrypt (Certbot)
- `/` → `frontend/dist/` (fichiers statiques Vite) avec `try_files` pour React Router
- `/api/` → proxy `localhost:3001`
- `/vault/` → proxy `localhost:5005`
- Redirection HTTP → HTTPS

### PM2

```js
// ecosystem.config.js
export default {
  apps: [
    {
      name: 'scrip-backend',
      script: './backend/src/server.js',
      env: { NODE_ENV: 'production', PORT: 3001 },
      max_memory_restart: '300M'
    },
    {
      name: 'scrip-webdav',
      script: 'dufs',
      args: '/home/scrip/vault --port 5005 --allow-all --auth "gabi:PASSWORD"',
      interpreter: 'none'
    }
  ]
}
```

### Backup cron

```
0 3 * * * zip -r /home/scrip/backups/vault-$(date +%Y%m%d).zip /home/scrip/vault/
```

### Workflow de déploiement

```bash
git pull
npm install
npm run build --workspace=frontend
pm2 restart all
```

---

## 8. Contraintes et décisions clés

| Décision | Raison |
|----------|--------|
| `capture="environment"` au lieu de `getUserMedia` | Fiabilité iOS PWA, zéro bug, comportement natif |
| lowdb au lieu de SQLite | Un seul utilisateur, config simple, JSON lisible/versionnable |
| `pages/` au lieu de `screens/` | Convention plus standard dans l'écosystème React |
| dufs au lieu du module WebDAV Nginx | Nginx WebDAV natif ne supporte pas LOCK (requis par Obsidian) |
| PM2 au lieu de `node` direct | Redémarre sur crash, survit aux déconnexions SSH, boot automatique |
| TanStack Query au lieu de Zustand/Redux | Les données viennent toutes du serveur — pas besoin de store client |
| Clés API dans `.env` uniquement | Jamais exposées au frontend, jamais dans db.json |

---

*Ce document est autoportant. Toute modification de l'architecture doit être répercutée ici avant implémentation.*
