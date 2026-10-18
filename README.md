<div align="center">

# Scrip

**Transforme tes photos de notes manuscrites en Markdown structuré, synchronisé avec Obsidian.**

`photo` &nbsp;→&nbsp; `IA vision` &nbsp;→&nbsp; `Markdown` &nbsp;→&nbsp; `vault Obsidian`

<br>

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white&style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
![Gratuit](https://img.shields.io/badge/100%25-Gratuit-22c55e?style=flat-square)
![Obsidian](https://img.shields.io/badge/Obsidian-WebDAV-7C3AED?logo=obsidian&logoColor=white&style=flat-square)
![Licence](https://img.shields.io/badge/Licence-AGPL%20v3%20%2B%20Commons%20Clause-red?style=flat-square)

</div>

---

## Table des matières

- [Aperçu](#aperçu)
- [Démarrage rapide](#démarrage-rapide)
- [100 % gratuit](#100--gratuit)
- [Configuration IA](#configuration-ia)
- [Configuration (.env)](#configuration-env)
- [Déploiement](#déploiement)
  - [VPS + PM2](#production-sur-un-vps-pm2) · [Docker](#production-avec-docker) · [Nginx et HTTPS](#nginx-et-https) · [Mise à jour](#mettre-à-jour) · [Dépannage](#logs-et-dépannage)
- [Sync Obsidian](#sync-obsidian)
- [Fonctionnement de l'ingestion](#fonctionnement-de-lingestion)
- [Prompts IA personnalisés](#prompts-ia-personnalisés)
- [Développement](#développement)
- [Licence](#licence)
- [Questions / Support](#questions--support)

---

## Aperçu

Scrip est une PWA auto-hébergée : tu prends tes cours en photo, une IA vision les lit, les structure en Markdown propre, et la note arrive dans ton vault Obsidian via WebDAV.

```
[Photo]  →  [OCR + IA vision]  →  [Markdown structuré]  →  [Vault Obsidian]
                    │
          Structuration automatique
          Correction OCR contextuelle
          Régions visuelles détectées
```

**Fonctionnalités principales**

- Capture multi-photos depuis le téléphone, **même hors ligne** (envoi automatique au retour du réseau)
- Organisation par niveaux et matières, avec un prompt IA par matière
- Plusieurs fournisseurs IA avec bascule automatique en cas d'erreur ou de quota atteint
- File d'ingestion persistante : un redémarrage ne perd aucune analyse
- Mode **Comparer** : photo originale à côté de la note, y compris pendant l'édition
- Serveur WebDAV intégré, compatible avec le plugin Obsidian *Remotely Save*

---

## Démarrage rapide

**Prérequis :** Node.js 20+ et un fournisseur IA ([Ollama](https://ollama.com) recommandé, gratuit).

```bash
git clone https://github.com/Gabizoc/Scrip.git
cd Scrip
chmod +x setup.sh && ./setup.sh
npm run dev
```

Ouvre ensuite `http://localhost:5000`.

Le script `setup.sh` installe les dépendances, pose les questions de configuration (authentification, fournisseur IA, clés API, modèles) et génère le `.env`.

<details>
<summary><b>Installation manuelle (sans le script, ou sous Windows)</b></summary>
<br>

```bash
cp .env.example .env   # puis éditer .env
npm install            # installe backend + frontend (workspaces npm)
npm run dev
```

> Minimum requis dans `.env` : `SESSION_SECRET` et **un** mode de connexion (`AUTH_PASSWORD`, ou `AUTH_EMAIL` + `SMTP_*`), plus la configuration d'au moins un fournisseur IA.

</details>

---

## 100 % gratuit

| Composant | Option gratuite |
|---|---|
| OCR + structuration | [Ollama](https://ollama.com) : `gemma4:31b-cloud` en cloud, sans GPU **(recommandé)** |
| Alternative cloud | [Google AI Studio](https://aistudio.google.com) : Gemini avec un quota généreux |
| Hébergement | VPS à ~3-5 €/mois, ou en local |
| Sync Obsidian | WebDAV intégré, aucun service tiers |

> **Config recommandée :** `PIPELINE_MODE=ollama` + `OLLAMA_MODEL=gemma4:31b-cloud`, aucune clé API requise.

---

## Configuration IA

`PIPELINE_MODE` choisit le fournisseur :

| Valeur | Comportement |
|---|---|
| `auto` *(défaut)* | Utilise le premier fournisseur configuré, dans l'ordre : Ollama → Google → NVIDIA → Mistral |
| `ollama` | Ollama local ou cloud (`OLLAMA_BASE_URL` ou `OLLAMA_API_KEY`) |
| `google` | Gemini (`GOOGLE_API_KEY`) |
| `nvidia` | NVIDIA NIM (`NVIDIA_API_KEY`) |
| `mistral` | OCR Mistral + structuration (`MISTRAL_API_KEY`) |

**OpenRouter** n'est pas un mode à part. Il ne reçoit **que du texte**, jamais les photos : la structuration du texte OCR en mode `mistral`, et le résumé automatique des notes (avec repli sur Ollama).

<details>
<summary><b>Ollama &nbsp;·&nbsp; recommandé, 100 % gratuit</b></summary>
<br>

Les modèles `:cloud` sont hébergés sur les serveurs Ollama : pas de GPU, pas de frais, pas de clé API.

**Linux (serveur) :**
```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl enable ollama && systemctl start ollama
ollama pull gemma4:31b-cloud
```

**Mac / Windows :** télécharger sur [ollama.com](https://ollama.com), puis :
```bash
ollama pull gemma4:31b-cloud
```

**Modèles recommandés** ([voir tous les modèles vision + cloud](https://ollama.com/search?c=vision&c=cloud)) :

| Modèle | Qualité | Quota |
|---|---|---|
| `gemma4:31b-cloud` | Très bon sur le français | Modéré, **recommandé** |
| `qwen3-vl:32b-cloud` | Excellent sur les tableaux et schémas | Élevé |
| `qwen3.5:cloud` | Très bonne compréhension | Modéré+ |

**`.env` :**
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:31b-cloud
OLLAMA_VALIDATION=true
```

**Sans installer Ollama : [Ollama Cloud](https://docs.ollama.com/cloud) en direct**

Crée une clé sur [ollama.com/settings/keys](https://ollama.com/settings/keys), puis :
```env
OLLAMA_API_KEY=ta_cle_ollama
OLLAMA_MODEL=gemma4:31b
```
Sans `OLLAMA_BASE_URL`, Scrip appelle directement `https://ollama.com`. Les suffixes `-cloud` / `:cloud` sont retirés automatiquement (`gemma4:31b-cloud` → `gemma4:31b`). Liste des modèles disponibles : `https://ollama.com/api/tags`.

</details>

<details>
<summary><b>Google Gemini &nbsp;·&nbsp; quota gratuit généreux</b></summary>
<br>

1. Va sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Clique sur **Create API key** (pas de carte bancaire requise)
3. Copie la clé dans `.env` :

```env
PIPELINE_MODE=google
GOOGLE_API_KEY=ta_cle_ici
```

Scrip essaie `gemini-2.5-flash`, puis bascule sur `gemini-2.0-flash`, `gemini-1.5-flash-latest` et `gemini-1.5-flash-8b` si le quota est atteint. Pour imposer un modèle : `GEMINI_MODEL=...`.

</details>

<details>
<summary><b>NVIDIA Build &nbsp;·&nbsp; quota offert à la création</b></summary>
<br>

1. Crée un compte sur [build.nvidia.com](https://build.nvidia.com)
2. Génère une clé dans **API Keys**
3. Copie-la dans `.env` :

```env
PIPELINE_MODE=nvidia
NVIDIA_API_KEY=ta_cle_ici
# Optionnel
# NVIDIA_VISION_MODEL=nvidia/llama-3.2-90b-vision-instruct
# NVIDIA_STRUCTURE_MODEL=mistralai/mistral-medium-3-instruct
```

</details>

<details>
<summary><b>Mistral &nbsp;·&nbsp; OCR dédié au manuscrit</b></summary>
<br>

Utilise `pixtral-large-latest` pour l'OCR, excellent sur l'écriture à la main.

1. Crée un compte sur [console.mistral.ai](https://console.mistral.ai)
2. Génère une clé dans **API Keys**
3. Copie-la dans `.env` :

```env
PIPELINE_MODE=mistral
MISTRAL_API_KEY=ta_cle_ici
# MISTRAL_OCR_MODEL=pixtral-large-latest
```

</details>

<details>
<summary><b>OpenRouter &nbsp;·&nbsp; secours avec des dizaines de modèles gratuits</b></summary>
<br>

[OpenRouter](https://openrouter.ai) donne accès à des dizaines de modèles, dont plusieurs gratuits (suffixe `:free`). Dans Scrip, il ne traite que du texte : structuration en mode `mistral` et résumé automatique.

1. Crée un compte sur [openrouter.ai](https://openrouter.ai)
2. Crée une clé dans **Keys**
3. Copie-la dans `.env` :

```env
OPENROUTER_API_KEY=ta_cle_ici
```

**Modèles gratuits par défaut** (modifiables via `OPENROUTER_STRUCTURE_MODEL` et `OPENROUTER_SUMMARY_MODEL`) :
- `google/gemma-4-26b-a4b-it:free`
- `google/gemma-4-31b-it:free`
- `meta-llama/llama-3.3-70b-instruct:free`

Si ces modèles sont saturés, Scrip se rabat en dernier recours sur `openrouter/free`, un routeur qui choisit un modèle gratuit au hasard (qualité variable, mais jamais facturé). Pour le résumé, si OpenRouter échoue (quota, erreur) ou n'est pas configuré, Scrip utilise Ollama s'il est configuré.

</details>

---

## Configuration (.env)

Copie `.env.example` en `.env` : chaque variable y est commentée. Les principales :

**Authentification** (un seul mode, Scrip refuse de démarrer si les deux sont configurés)

| Variable | Description |
|---|---|
| `SESSION_SECRET` | **Requis.** Secret aléatoire de 16 caractères minimum (la valeur d'exemple est refusée en production) |
| `AUTH_PASSWORD` | Mode 1 : mot de passe simple (recommandé, aucun serveur mail requis) |
| `AUTH_EMAIL` + `SMTP_*` | Mode 2 : connexion par lien magique envoyé par email |
| `PUBLIC_URL` | URL publique, utilisée pour les liens WebDAV et les liens magiques |

**IA**

| Variable | Description |
|---|---|
| `PIPELINE_MODE` | `auto` (défaut) / `ollama` / `google` / `nvidia` / `mistral` |
| `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `OLLAMA_MODEL` | Ollama local ou cloud |
| `GOOGLE_API_KEY`, `GEMINI_MODEL` | Google Gemini |
| `NVIDIA_API_KEY` | NVIDIA NIM |
| `MISTRAL_API_KEY` | Mistral |
| `OPENROUTER_API_KEY` | OpenRouter (texte seulement : structuration en mode `mistral`, résumé) |
| `LLM_TIMEOUT_MS` | Délai max d'un appel IA (défaut `180000`) |

**Serveur**

| Variable | Description |
|---|---|
| `PORT` | Port du backend (défaut `7001`) |
| `FRONTEND_PORT` | Port du serveur de dev Vite (défaut `5000`) |
| `SERVE_FRONTEND` | `true` : le backend sert aussi le frontend compilé (utilisé par Docker) |
| `LOG_LEVEL` | `info` (défaut) ou `debug` pour les traces détaillées du pipeline (contenu des notes inclus) |
| `DEBUG_PIPELINE` | `true` active aussi le niveau `debug` |

Générer un `SESSION_SECRET` :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Déploiement

Trois façons de faire tourner Scrip :

| Méthode | Pour qui | Frontend servi par |
|---|---|---|
| [Développement local](#développement-local) | Tester ou modifier le code | Vite (`localhost:5000`) |
| [VPS + PM2](#production-sur-un-vps-pm2) | Serveur Linux, installation « classique » | Nginx (`frontend/dist`) |
| [Docker](#production-avec-docker) | Tout-en-un, mises à jour simples | Le backend (`SERVE_FRONTEND=true`) |

En production, **HTTPS est obligatoire** : les cookies de session sont marqués `secure` (sinon la connexion échoue en boucle) et la PWA a besoin d'HTTPS pour s'installer et fonctionner hors ligne.

### Développement local

```bash
npm install
npm run dev
```

Ouvre `http://localhost:5000`. Vite sert le frontend avec rechargement à chaud et redirige `/api` vers le backend (port `7001`), qui redémarre à chaque modification.

### Production sur un VPS (PM2)

**Prérequis :** un VPS Linux (Debian/Ubuntu), un nom de domaine qui pointe vers son IP, les ports 80 et 443 ouverts.

**1. Installer Node.js, PM2 et Nginx**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
```

**2. Récupérer et configurer Scrip**

```bash
git clone https://github.com/Gabizoc/Scrip.git /var/www/scrip
cd /var/www/scrip
./setup.sh             # ou : cp .env.example .env, puis éditer
```

Dans `.env`, vérifie au minimum :
- `SESSION_SECRET` : une vraie valeur aléatoire (la valeur d'exemple est refusée en production) ;
- `AUTH_PASSWORD` (ou `AUTH_EMAIL` + `SMTP_*`) ;
- `PUBLIC_URL=https://ton-domaine.com` ;
- la configuration d'au moins un fournisseur IA.

**3. Compiler et lancer**

```bash
npm install
npm run build          # génère frontend/dist, servi par Nginx
pm2 start ecosystem.config.cjs
pm2 save               # mémorise les processus lancés
pm2 startup            # relance PM2 au démarrage du serveur (exécuter la commande affichée)
```

`ecosystem.config.cjs` lance le backend avec `NODE_ENV=production` sur le port `7001`. Ce port **prend le pas sur `PORT` du `.env`** : pour en changer, modifie-le dans `ecosystem.config.cjs` et dans la config Nginx.

**4. Vérifier que le backend répond**

```bash
curl http://127.0.0.1:7001/api/auth/status
```

Il reste à configurer [Nginx et HTTPS](#nginx-et-https).

### Production avec Docker

**Prérequis :** Docker avec le plugin Compose, et Nginx sur l'hôte pour le HTTPS.

```bash
git clone https://github.com/Gabizoc/Scrip.git && cd Scrip
cp .env.example .env   # remplir SESSION_SECRET, AUTH_PASSWORD, PUBLIC_URL, clés IA…
docker compose up -d --build
```

Ce que fait l'image :
- elle compile le frontend et le sert depuis le backend, avec l'API et le WebDAV, sur le port `7001` ;
- le port n'est publié que sur `127.0.0.1` : l'application n'est pas exposée directement, il faut Nginx devant ;
- la base (`backend/data`) et les notes (`vault`) sont montées depuis l'hôte : elles survivent aux reconstructions de l'image ;
- un healthcheck interroge `/api/auth/status` toutes les 30 s (`docker compose ps` affiche l'état).

Le conteneur tourne avec l'utilisateur `node` (UID 1000). Si les logs affichent une erreur `EACCES` sur `backend/data` ou `vault` :

```bash
sudo chown -R 1000:1000 backend/data vault
```

**Ollama installé sur l'hôte :** décommente `OLLAMA_BASE_URL: http://host.docker.internal:11434` dans `docker-compose.yml`. Par défaut, Ollama n'écoute que sur `127.0.0.1` : lance-le avec `OLLAMA_HOST=0.0.0.0` pour que le conteneur puisse le joindre. Inutile avec Ollama Cloud (`OLLAMA_API_KEY`).

### Nginx et HTTPS

La config d'exemple (`nginx/scrip.conf.example`) fait référence aux certificats Let's Encrypt : obtiens-les **avant** d'activer le site, sinon `nginx -t` échoue.

**1. Obtenir le certificat**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d ton-domaine.com
```

Le renouvellement est automatique ; pour le tester : `sudo certbot renew --dry-run`.

**2. Installer la config**

```bash
sudo cp nginx/scrip.conf.example /etc/nginx/sites-available/scrip
sudo nano /etc/nginx/sites-available/scrip   # remplacer YOUR_DOMAIN et YOUR_APP_PATH
sudo ln -s /etc/nginx/sites-available/scrip /etc/nginx/sites-enabled/scrip
sudo nginx -t && sudo systemctl reload nginx
```

Ce que fait la config :

| Chemin | Rôle |
|---|---|
| `/` | Sert `frontend/dist`, avec repli sur `index.html` pour le routage de la PWA |
| `/sw.js` | Jamais mis en cache, sinon les téléphones ne voient pas les mises à jour |
| `/api/` | Proxy vers le backend ; timeout de 300 s pour le pipeline IA, uploads jusqu'à 210 Mo |
| `/webdav/` | Proxy vers le serveur WebDAV pour Obsidian |
| port 80 | Redirection vers HTTPS |

**Avec Docker**, le backend sert aussi le frontend : remplace les blocs `root`, `location /`, `/sw.js` et le cache des assets par un proxy unique (en gardant `/api/` tel quel pour ses timeouts) :

```nginx
location / {
    proxy_pass         http://127.0.0.1:7001;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    client_max_body_size 50m;
}
```

### Mettre à jour

**PM2 :**
```bash
cd /var/www/scrip
git pull
npm install
npm run build
pm2 restart scrip-backend
```

**Docker :**
```bash
git pull
docker compose up -d --build
```

Les téléphones récupèrent la nouvelle version de la PWA au prochain lancement.

### Sauvegardes

Toutes les données tiennent dans deux dossiers, à sauvegarder régulièrement :

| Dossier | Contenu |
|---|---|
| `backend/data/` | Base JSON (matières, notes, paramètres), sessions, photos en attente de traitement |
| `vault/` | Notes Markdown (aussi présentes dans ton vault Obsidian si la sync est active) |

```bash
tar czf scrip-backup-$(date +%F).tar.gz backend/data vault
```

Pour repartir d'une base vide : `npm run db:reset`.

### Logs et dépannage

**Logs :** `pm2 logs scrip-backend` (fichiers dans `logs/`) ou `docker compose logs -f`. Pour plus de détails sur le pipeline IA : `LOG_LEVEL=debug`.

| Symptôme | Cause probable |
|---|---|
| Le serveur refuse de démarrer | `SESSION_SECRET` absent, trop court ou encore la valeur d'exemple, ou les deux modes de connexion configurés à la fois : le message d'erreur indique lequel |
| La connexion réussit puis renvoie à l'écran de login | Site servi en HTTP : en production, le cookie de session n'est envoyé qu'en HTTPS |
| `413 Request Entity Too Large` à l'envoi de photos | `client_max_body_size` trop faible dans Nginx |
| `504 Gateway Timeout` pendant une analyse | `proxy_read_timeout` trop court pour le modèle IA utilisé |
| L'app ne se met pas à jour sur le téléphone | `/sw.js` mis en cache par Nginx ou un CDN |
| `EACCES` sous Docker | Droits des dossiers montés (voir [Docker](#production-avec-docker)) |


---

## Sync Obsidian

1. Installe le plugin **Remotely Save** dans Obsidian
2. Choisis **WebDAV** et entre l'URL : `https://ton-domaine.com/webdav`
3. Identifiant et mot de passe : ceux configurés dans **Paramètres > WebDAV**. Par défaut, WebDAV utilise le mot de passe de connexion ; tu peux définir un mot de passe dédié (conseillé, puisqu'il reste stocké dans Obsidian).
4. **Remote base dir** : même valeur que « Dossier de synchronisation » dans les Paramètres

Réglages recommandés dans Remotely Save :

| Paramètre | Valeur recommandée |
|---|---|
| Synchronisation automatique au démarrage | Une fois, 1 seconde après le démarrage |
| Sync à la sauvegarde (expérimental) | Activer |
| Annuler la sync si modification supérieure à % | 100 (protection désactivée) |

---

## Fonctionnement de l'ingestion

- Les photos envoyées entrent dans une **file persistante** (`backend/data/uploads`) et sont traitées une par une. Si le serveur redémarre, l'analyse en cours reprend automatiquement.
- **Hors ligne**, la PWA garde la capture sur l'appareil et l'envoie dès le retour du réseau (visible dans la file d'attente de la page Capture).
- Formats acceptés : JPEG, PNG, WebP (jusqu'à 10 photos de 20 Mo). Le HEIC n'est pas pris en charge : sur iPhone, choisis *Réglages > Appareil photo > Formats > Le plus compatible*.
- Sur ordinateur, le bouton **Comparer** d'une note affiche la photo originale à côté, y compris pendant l'édition.

---

## Prompts IA personnalisés

Ajoute un fichier dans `backend/prompts/` en suivant le modèle `prompt.example.js` :

```js
export const name = 'Ma matière';
export const prompt = `Ton prompt personnalisé...`;
```

Il apparaît automatiquement dans la liste déroulante à la création d'une matière. Le prompt est utilisé par tous les fournisseurs ; les consignes de lecture d'image y sont ajoutées automatiquement.

---

## Développement

| Commande | Rôle |
|---|---|
| `npm run dev` | Backend (watch) + frontend Vite en parallèle |
| `npm run dev:backend` / `npm run dev:frontend` | Un seul des deux |
| `npm run build` | Compile le frontend dans `frontend/dist` |
| `npm run lint` | ESLint (backend + frontend) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run db:reset` | Réinitialise la base de données |

```
Scrip/
├── backend/
│   ├── src/
│   │   ├── pipeline/   # fournisseurs IA, OCR, structuration, résumé
│   │   ├── routes/     # API REST (auth, ingest, notes, matières…)
│   │   └── webdav.js   # serveur WebDAV pour Obsidian
│   ├── prompts/        # prompts IA par matière
│   └── data/           # base JSON + file d'uploads (non versionné)
├── frontend/           # PWA React + Vite + Tailwind
├── nginx/              # exemple de config Nginx
├── vault/              # notes Markdown générées (non versionné)
└── setup.sh            # installation interactive
```

La CI GitHub Actions lance le lint, une vérification syntaxique du backend, le build du frontend et le build de l'image Docker.

---

## Licence

[AGPL v3](LICENSE) avec la **Commons Clause** : tu peux utiliser, modifier et auto-héberger Scrip librement, mais pas le **vendre**, y compris sous forme de service hébergé payant. Voir [LICENSE](LICENSE).

---

## Questions / Support

Un bug ? Une question sur l'installation ? Tu veux adapter Scrip à ton usage ?

- Ouvre une [issue GitHub](../../issues)
- Ou contacte-moi sur [gabizoc.fr](https://gabizoc.fr), où tu trouveras aussi mes autres projets
