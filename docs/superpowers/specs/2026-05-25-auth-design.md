# Auth — Login email + mdp + magic link + reset — Design Spec

**Date :** 2026-05-25
**Contexte :** Scrip tourne sur un serveur Debian derrière Nginx + HTTPS. L'app est personnelle (un seul utilisateur). Aucune auth n'existe côté web actuellement. Le WebDAV a déjà un Basic Auth bcrypt.

---

## Objectif

Protéger l'intégralité de l'app web (frontend + API) et partager le même hash de mot de passe avec le WebDAV. La config sensible (email, SMTP) reste dans `.env`, jamais en base de données.

---

## Variables d'environnement (`.env`)

```env
# Auth
AUTH_EMAIL=gabi@gmail.com
SESSION_SECRET=une-chaine-aleatoire-longue-32-chars-min

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=gabi@gmail.com
SMTP_PASS=ton-app-password-gmail
SMTP_FROM=Scrip <gabi@gmail.com>
```

Le backend valide la présence de `SESSION_SECRET` et `AUTH_EMAIL` au démarrage — erreur fatale si absents.

---

## Base de données (`db.data.settings.auth`)

```js
auth: {
  passwordHash: null,           // bcrypt hash — null = setup requis
  pendingSetupToken: null,      // { hash, expiresAt } | null
  pendingResetToken: null,      // { hash, expiresAt } | null
  pendingMagicToken: null,      // { hash, expiresAt } | null
}
```

Le token en clair est envoyé par email, seul son hash bcrypt est stocké en db. Chaque token expire après 15 minutes. Le WebDAV lit `auth.passwordHash` (même hash, une seule source de vérité).

---

## Architecture

```
Internet
    ↕ HTTPS
Nginx
    /* → Express :5001
         ↕
    requireAuth middleware (toutes les routes /api/* sauf /api/auth/*)
         ↕
    Routes auth (publiques)
         ↕
    nodemailer → SMTP
```

---

## Routes backend

### Publiques (sans auth)

| Route | Corps | Action |
|---|---|---|
| `GET /api/auth/status` | — | `{ loggedIn: bool, needsSetup: bool }` |
| `POST /api/auth/setup-request` | — | Vérifie needsSetup, génère token, envoie email setup à `AUTH_EMAIL` |
| `GET /api/auth/setup/:token` | — | Vérifie token → redirect `/setup/password?token=…` |
| `POST /api/auth/setup-complete` | `{ token, password }` | Hash bcrypt → sauve `auth.passwordHash` → session → 200 |
| `POST /api/auth/login` | `{ email, password }` | Vérifie email vs `AUTH_EMAIL`, mdp vs hash → session → 200 |
| `POST /api/auth/magic` | — | Génère magic token → envoie email → 200 |
| `GET /api/auth/magic/:token` | — | Vérifie token → session → redirect `/` |
| `POST /api/auth/forgot` | — | Génère reset token → envoie email → 200 |
| `POST /api/auth/reset` | `{ token, password }` | Vérifie token → nouveau hash → 200 |

### Protégées (auth requise)

| Route | Action |
|---|---|
| `POST /api/auth/logout` | Destroy session → 200 |

---

## Middleware `requireAuth`

```js
// backend/src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  if (req.session?.loggedIn === true) return next();
  res.status(401).json({ error: 'Non authentifié' });
}
```

Appliqué dans `app.js` sur toutes les routes `/api/*` sauf `/api/auth/*`.

---

## Session

Package : `express-session`
- Store : MemoryStore (suffisant pour usage mono-process, re-login si PM2 redémarre)
- Cookie : `httpOnly: true`, `secure: true` (prod HTTPS), `maxAge: 30j`
- Secret : `process.env.SESSION_SECRET`

---

## Mailer (`backend/src/lib/mailer.js`)

```js
import nodemailer from 'nodemailer';

export function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendMail({ to, subject, html }) {
  const transporter = createTransporter();
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}
```

---

## Flow premier login (setup)

```
1. Déploiement → db vide → auth.passwordHash = null
2. Visite app → AuthGuard → GET /api/auth/status → { needsSetup: true }
3. Redirect /setup
4. Clic "Envoyer le lien" → POST /api/auth/setup-request
   → token généré → hash en db → email envoyé à AUTH_EMAIL
5. Clic lien email → GET /api/auth/setup/:token
   → redirect /setup/password?token=…
6. Formulaire "Choisir un mot de passe" → POST /api/auth/setup-complete
   → bcrypt hash → db → session créée → redirect /
7. setup-request et setup-complete retournent 403 si passwordHash ≠ null
```

---

## Flow login normal

```
/login → email + mdp → POST /api/auth/login
  → email == AUTH_EMAIL && bcrypt.compare(mdp, hash) → session → redirect /
  → sinon → 401 "Email ou mot de passe incorrect"
```

## Flow magic link

```
/login → clic "Connexion par email" → POST /api/auth/magic
  → token généré → email envoyé → message "Vérifie ta boîte mail"
GET /api/auth/magic/:token → session → redirect /
```

## Flow reset mot de passe

```
/login → "Mot de passe oublié" → POST /api/auth/forgot
  → token généré → email envoyé → message "Vérifie ta boîte mail"
Clic lien → /reset/:token → formulaire nouveau mdp
POST /api/auth/reset { token, password } → nouveau hash → 200
```

---

## Frontend

### Nouvelles pages

| Page | Route | Description |
|---|---|---|
| `Login.jsx` | `/login` | Email + mdp + bouton "Magic link" + lien "Mot de passe oublié" |
| `Setup.jsx` | `/setup` | Bouton "Envoyer le lien de configuration" + état d'attente |
| `SetupPassword.jsx` | `/setup/password` | Formulaire choisir mdp (+ confirmation) |
| `MagicLanding.jsx` | `/auth/magic/:token` | Appel API → redirect / ou erreur |
| `ResetPassword.jsx` | `/reset/:token` | Formulaire nouveau mdp (+ confirmation) |

### `AuthGuard` (wraps toutes les routes dans `App.jsx`)

```
GET /api/auth/status
  → { needsSetup: true }  → redirect /setup
  → { loggedIn: false }   → redirect /login
  → { loggedIn: true }    → render enfants
```

### `frontend/src/lib/auth.js`

```js
export const authApi = {
  status:         () => fetch('/api/auth/status').then(r => r.json()),
  login:          (email, password) => ...,
  magic:          () => ...,
  forgot:         () => ...,
  reset:          (token, password) => ...,
  setupRequest:   () => ...,
  setupComplete:  (token, password) => ...,
  logout:         () => ...,
};
```

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `backend/src/routes/auth.js` | Créer |
| `backend/src/middleware/requireAuth.js` | Créer |
| `backend/src/lib/mailer.js` | Créer |
| `backend/src/db.js` | Modifier — ajouter `auth` aux defaults + deep merge |
| `backend/src/app.js` | Modifier — session + requireAuth + authRouter |
| `backend/src/webdav.js` | Modifier — lire `auth.passwordHash` au lieu de `webdav.passwordHash` |
| `backend/tests/auth.test.js` | Créer |
| `.env.example` | Modifier — ajouter vars auth + SMTP |
| `frontend/src/App.jsx` | Modifier — AuthGuard + nouvelles routes |
| `frontend/src/lib/auth.js` | Créer |
| `frontend/src/pages/Login.jsx` | Créer |
| `frontend/src/pages/Setup.jsx` | Créer |
| `frontend/src/pages/SetupPassword.jsx` | Créer |
| `frontend/src/pages/MagicLanding.jsx` | Créer |
| `frontend/src/pages/ResetPassword.jsx` | Créer |

---

## Hors scope

- Multi-utilisateur
- OAuth (Google, GitHub…)
- 2FA
- Rate limiting sur les routes auth (à ajouter post-MVP si besoin)
- Chiffrement du SMTP password en db (non pertinent — config locale)
