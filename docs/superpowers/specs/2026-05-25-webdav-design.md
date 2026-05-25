# WebDAV Obsidian Sync — Design Spec

**Date :** 2026-05-25
**Contexte :** Scrip tourne sur un serveur Debian derrière Nginx + HTTPS. Obsidian se connecte via le plugin "Remotely Save" en WebDAV.

---

## Objectif

Exposer le vault local de Scrip en WebDAV depuis le serveur Express, protégé par basic auth (bcrypt). Obsidian se connecte à `https://scrip.mondomaine.com/webdav` via Remotely Save. Aucune dépendance externe — Scrip est autonome.

---

## Architecture

```
Internet
    ↕ HTTPS :443
Nginx (reverse proxy + TLS Let's Encrypt)
    /webdav/*  → proxy_pass → Express :3001/webdav/*
    /*         → proxy_pass → Express :3001/*
                                  ↕ filesystem
                               vault/ (local Debian)
Obsidian (Remotely Save plugin)
    → https://scrip.mondomaine.com/webdav
```

Nginx gère TLS. Scrip reste HTTP en interne. Tous les verbes WebDAV (GET, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, OPTIONS) passent via `proxy_pass` sans modification.

---

## Backend

### Nouveau package

```
npm install webdav-server bcrypt
```

### `backend/src/webdav.js` (nouveau)

- Crée un `WebDAVServer` (package `webdav-server` v2) qui expose `vaultPath` via `PhysicalFileSystem`
- Exporte une fonction `createWebdavMiddleware(db)` qui retourne un middleware Express
- À chaque requête :
  1. Relit `db.data.settings.webdav` (activation à chaud)
  2. Si `enabled === false` → répond 503
  3. Vérifie le header `Authorization: Basic <base64>` → compare avec `passwordHash` (bcrypt)
  4. Si auth KO → répond 401 avec `WWW-Authenticate: Basic realm="Scrip"`
  5. Si auth OK → passe au handler WebDAV

### `backend/src/db.js`

Ajout dans `DEFAULT_DATA.settings` :
```js
webdav: {
  enabled: false,
  username: 'scrip',
  passwordHash: null,  // bcrypt hash — jamais exposé via GET /settings
},
publicUrl: '',  // ex. "https://scrip.mondomaine.com"
```

### `backend/src/routes/settings.js`

**GET `/api/settings`** — ajoute `webdav` dans la réponse **sans** `passwordHash` :
```js
const { webdav: { passwordHash, ...webdavPublic }, ...rest } = db.data.settings;
res.json({ ...rest, webdav: webdavPublic });
```

**PUT `/api/settings`** — champs acceptés supplémentaires :
- `webdav.enabled` (boolean)
- `webdav.username` (string)
- `webdav.password` (string en clair → haché bcrypt avant stockage, champ `passwordHash`)
- `publicUrl` (string)

### `backend/src/app.js`

```js
import { createWebdavMiddleware } from './webdav.js';
app.use('/webdav', createWebdavMiddleware(db));
```

---

## Frontend

### `frontend/src/lib/api.js`

Ajout dans `api.putSettings` : déjà générique, aucune modification nécessaire.

### `frontend/src/pages/Settings/index.jsx` ou section dédiée

Nouvelle section **"Obsidian WebDAV"** :

1. **Toggle activer/désactiver** — `PUT /api/settings { webdav: { enabled } }`
2. **Champ `publicUrl`** — ex. `https://scrip.mondomaine.com`
3. **Champ username** — pré-rempli `scrip`
4. **Champ password** — type `password` + bouton "Générer" (16 chars aléatoires)
5. **Bouton "Enregistrer"** — envoie username + password en clair (HTTPS uniquement)
6. **URL WebDAV** — calculée : `${publicUrl}/webdav` — bouton copier (affiché uniquement si `enabled && publicUrl`)
7. **Snippet Nginx** — affiché dans un `<pre>` copiable :

```nginx
location /webdav/ {
    proxy_pass http://localhost:3001/webdav/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 10M;
}
```

8. **Guide Remotely Save** — 3 étapes inline :
   - Installer le plugin "Remotely Save" dans Obsidian
   - Choisir WebDAV, coller l'URL `/webdav`
   - Entrer username/password → "Test"

---

## Hors scope

- Sync bidirectionnelle Obsidian → Scrip (géré par Remotely Save)
- Gestion des conflits de merge
- Multi-utilisateur (un seul compte WebDAV)
- Notifications de sync côté Scrip

---

## Sécurité

- Le `passwordHash` ne quitte jamais le backend
- Le password en clair ne transite que via HTTPS (Nginx + TLS)
- bcrypt avec salt factor 10
- Sans `publicUrl` configuré, l'URL WebDAV n'est pas affichée (pas de fausse URL HTTP)
