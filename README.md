<div align="center">

# Scrip

**Transforme tes photos de notes manuscrites en Markdown structure, synchronise avec Obsidian.**

`photo` &nbsp;->&nbsp; `IA vision` &nbsp;->&nbsp; `Markdown` &nbsp;->&nbsp; `vault Obsidian`

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

## Table des matieres

- [Apercu](#apercu)
- [100% gratuit](#100-gratuit)
- [Configuration IA](#configuration-ia)
- [Stack](#stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Deploiement](#deploiement)
- [Sync Obsidian](#sync-obsidian)
- [Ingestion](#fonctionnement-de-lingestion)
- [Developpement](#developpement)
- [Prompts personnalises](#prompts-ia-personnalises)
- [Structure](#structure)

---

## Apercu

Scrip est une PWA qui transforme automatiquement tes photos de cours en notes Markdown structurees, puis les synchronise avec ton vault Obsidian via WebDAV.

```
[Photo]  ->  [OCR + IA vision]  ->  [Markdown structure]  ->  [Obsidian vault]
                    |
          Structuration automatique
          Correction OCR contextuelle
          Regions visuelles detectees
```

---

## 100% gratuit

| Composant | Option gratuite |
|---|---|
| OCR + structuration | [Ollama](https://ollama.com) - `gemma4:31b-cloud` en cloud, sans GPU **(recommande)** |
| Alt. cloud | [Google AI Studio](https://aistudio.google.com) - Gemini avec quota genereux |
| Hebergement | VPS ~3-5 EUR/mois, ou en local |
| Sync Obsidian | WebDAV integre, aucun service tiers |

> **Config recommandee :** `PIPELINE_MODE=ollama` + `OLLAMA_MODEL=gemma4:31b-cloud` - aucune cle API requise.

---

## Configuration IA

Choisis ton provider selon tes besoins - tu peux en activer plusieurs, Scrip bascule automatiquement :

<details>
<summary><b>Ollama &nbsp;-&nbsp; recommande, 100% gratuit</b></summary>
<br>

Les modeles `:cloud` sont heberges sur les serveurs Ollama. Pas de GPU, pas de frais, pas de cle API.

**Linux (serveur) :**
```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl enable ollama && systemctl start ollama
ollama pull gemma4:31b-cloud
```

**Mac / Windows :** telecharger sur [ollama.com](https://ollama.com), puis :
```bash
ollama pull gemma4:31b-cloud
```

**Modeles recommandes** - [voir tous les modeles vision+cloud](https://ollama.com/search?c=vision&c=cloud) :

| Modele | Qualite | Quota |
|---|---|---|
| `gemma4:31b-cloud` | Tres bon sur le francais | Modere - **recommande** |
| `qwen3-vl:32b-cloud` | Excellent sur tableaux et schemas | Eleve |
| `qwen3.5:cloud` | Tres bonne comprehension | Modere+ |

**`.env` :**
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:31b-cloud
OLLAMA_VALIDATION=true
```

**Sans installer Ollama - [Ollama Cloud](https://docs.ollama.com/cloud) direct :**

Cree une cle sur [ollama.com/settings/keys](https://ollama.com/settings/keys), puis :
```env
OLLAMA_API_KEY=ta_cle_ollama
OLLAMA_MODEL=gemma4:31b
```
Sans `OLLAMA_BASE_URL`, Scrip appelle directement `https://ollama.com`. Les noms en `-cloud` / `:cloud` sont convertis automatiquement (`gemma4:31b-cloud` -> `gemma4:31b`). Liste des modeles dispo : `https://ollama.com/api/tags`.

</details>

<details>
<summary><b>Google Gemini &nbsp;-&nbsp; quota gratuit genereux</b></summary>
<br>

1. Va sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Clique **Create API key** - pas de carte bancaire requise
3. Copie dans `.env` :

```env
GOOGLE_API_KEY=ta_cle_ici
```

Scrip essaie `gemini-2.5-flash` en premier et bascule automatiquement sur `gemini-1.5-flash-latest` puis `gemini-1.5-flash-8b` si le quota est atteint.

</details>

<details>
<summary><b>NVIDIA Build &nbsp;-&nbsp; quota offert a la creation</b></summary>
<br>

1. Cree un compte sur [build.nvidia.com](https://build.nvidia.com)
2. Genere une cle dans **API Keys**
3. Copie dans `.env` :

```env
PIPELINE_MODE=nvidia
NVIDIA_API_KEY=ta_cle_ici
```

</details>

<details>
<summary><b>Mistral &nbsp;-&nbsp; OCR manuscrit dedie</b></summary>
<br>

Utilise `pixtral-large-latest` pour l'OCR des notes manuscrites - excellent sur l'ecriture a la main.

1. Cree un compte sur [console.mistral.ai](https://console.mistral.ai)
2. Genere une cle dans **API Keys**
3. Copie dans `.env` :

```env
PIPELINE_MODE=mistral
MISTRAL_API_KEY=ta_cle_ici
```

</details>

<details>
<summary><b>OpenRouter &nbsp;-&nbsp; dizaines de modeles gratuits</b></summary>
<br>

[OpenRouter](https://openrouter.ai) donne acces a des dizaines de modeles, dont plusieurs gratuits (suffixe `:free`).

1. Cree un compte sur [openrouter.ai](https://openrouter.ai)
2. Cree une cle dans **Keys**
3. Copie dans `.env` :

```env
OPENROUTER_API_KEY=ta_cle_ici
```

**Modeles gratuits recommandes** (configurables via `OPENROUTER_VISION_MODEL`) :
- `google/gemma-4-26b-a4b-it:free`
- `google/gemma-4-31b-it:free`
- `meta-llama/llama-3.3-70b-instruct:free`

Scrip bascule sur `openrouter/auto` si la limite journaliere est atteinte.

</details>

---

## Stack

| Couche | Technologies |
|---|---|
| Backend | Node.js 20+, Express 5, lowdb (JSON), zod, pino |
| Frontend | React 18, Vite, Tailwind CSS, PWA (service worker, file hors ligne) |
| IA | Ollama / Google Gemini / NVIDIA / Mistral / OpenRouter |
| Sync | WebDAV natif, compatible Obsidian Remotely Save |

---

## Installation

**Prerequis :** Node.js 20+, [Ollama](https://ollama.com) (recommande, gratuit)

```bash
git clone https://github.com/Gabizoc/Scrip.git
cd Scrip
chmod +x setup.sh && ./setup.sh
```

Le script installe toutes les dependances, pose les questions de configuration (auth, pipeline, cles API, modeles) et genere le `.env` automatiquement.

<details>
<summary><b>Installation manuelle (sans le script)</b></summary>
<br>

```bash
cp .env.example .env
# Editer .env manuellement
npm install          # installe backend + frontend (workspaces npm)
npm run build
```

> Minimum requis dans `.env` : `AUTH_PASSWORD`, `SESSION_SECRET`

</details>

---

## Configuration

Copier `.env.example` en `.env` et remplir :

| Variable | Requis | Description |
|---|---|---|
| `AUTH_PASSWORD` | oui | Mot de passe pour se connecter |
| `SESSION_SECRET` | oui | Secret aleatoire (16 caracteres minimum ; la valeur d'exemple est refusee en production) |
| `PUBLIC_URL` | non | URL publique (pour les liens WebDAV) |
| `GOOGLE_API_KEY` | non | Cle Google AI Studio pour Gemini |
| `OLLAMA_BASE_URL` | non | URL du serveur Ollama |
| `OLLAMA_API_KEY` | non | Cle Ollama Cloud (appel direct a ollama.com, sans installation) |
| `PIPELINE_MODE` | non | `auto` (defaut) / `ollama` / `google` / `nvidia` / `mistral` |
| `PORT` | non | Port du backend (defaut `7001`) |
| `FRONTEND_PORT` | non | Port du serveur de dev Vite (defaut `5000`) |
| `LOG_LEVEL` | non | `info` (defaut) ou `debug` pour les traces detaillees du pipeline |
| `LLM_TIMEOUT_MS` | non | Delai max d'un appel IA (defaut `180000`) |
| `SERVE_FRONTEND` | non | `true` : le backend sert aussi le frontend compile (utilise par Docker) |

Generer un `SESSION_SECRET` :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Deploiement

<details>
<summary><b>Developpement local</b></summary>
<br>

```bash
npm install
npm run dev
```

Ouvre `http://localhost:5000`

> Le frontend est servi par Vite en dev - pas besoin de le builder.

</details>

<details>
<summary><b>Production (VPS + PM2)</b></summary>
<br>

```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
```

Reset de la base de donnees :
```bash
node backend/scripts/reset-db.js
```

</details>

<details>
<summary><b>Docker</b></summary>
<br>

```bash
cp .env.example .env   # remplir AUTH_PASSWORD, SESSION_SECRET, cles IA…
docker compose up -d --build
```

L'image sert l'API, le WebDAV et le frontend sur le port `7001` (lie a `127.0.0.1` : place Nginx + HTTPS devant, les cookies de session etant `secure` en production). La base (`backend/data`) et le vault (`vault`) sont montes en volumes.

Pour un Ollama installe sur la machine hote, decommenter `OLLAMA_BASE_URL` dans `docker-compose.yml`.

</details>

<details>
<summary><b>Nginx</b></summary>
<br>

```bash
cp nginx/scrip.conf.example /etc/nginx/sites-available/scrip
# Editer le fichier et remplacer YOUR_DOMAIN par ton domaine
ln -s /etc/nginx/sites-available/scrip /etc/nginx/sites-enabled/scrip
nginx -t && systemctl reload nginx
```

</details>

<details>
<summary><b>HTTPS avec Certbot (Let's Encrypt)</b></summary>
<br>

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d ton-domaine.com
```

Certbot modifie automatiquement la config Nginx et renouvelle le certificat via un cron. Pour verifier le renouvellement automatique :

```bash
certbot renew --dry-run
```

</details>

---

## Sync Obsidian

1. Installer le plugin **Remotely Save** dans Obsidian
2. Choisir **WebDAV**, entrer l'URL : `https://ton-domaine.com/webdav`
3. Identifiant et mot de passe : configures dans Parametres > WebDAV. Par defaut, WebDAV utilise le mot de passe de connexion ; tu peux definir un mot de passe dedie (conseille, il reste stocke dans Obsidian).
4. **Remote base dir** : meme valeur que "Dossier de synchronisation" dans Parametres

Reglages recommandes dans Remotely Save :

| Parametre | Valeur recommandee |
|---|---|
| Synchronisation automatique au demarrage | Une fois, 1 seconde apres le demarrage |
| Sync a la sauvegarde (experimental) | Activer |
| Annuler la sync si modification superieure a % | 100 (protection desactivee) |

---

## Fonctionnement de l'ingestion

- Les photos envoyees sont placees dans une **file persistante** (`backend/data/uploads`) et traitees une par une : un redemarrage du serveur ne perd pas une analyse en cours, elle reprend automatiquement.
- **Hors ligne**, la PWA enregistre la capture sur l'appareil et l'envoie toute seule au retour du reseau (visible dans la file d'attente de la page Capture).
- Formats acceptes : JPEG, PNG, WebP (10 photos de 20 Mo max). Sur iPhone, choisir *Reglages > Appareil photo > Formats > Le plus compatible* (le HEIC n'est pas pris en charge).
- Sur ordinateur, le bouton **Comparer** d'une note affiche la photo originale a cote, y compris pendant l'edition.

---

## Developpement

```bash
npm run lint           # ESLint (backend + frontend)
npm run format         # Prettier
```

La CI GitHub Actions lance le lint, une verification syntaxique du backend, le build du frontend et le build de l'image Docker.

---

## Prompts IA personnalises

Ajouter un fichier dans `backend/prompts/` en suivant le template `prompt.example.js` :

```js
export const name = 'Ma matiere';
export const prompt = `Ton prompt personnalise...`;
```

Il apparait automatiquement dans le dropdown lors de la creation d'une matiere. Le prompt est utilise par tous les fournisseurs (Ollama, Gemini, NVIDIA, Mistral) ; les consignes de lecture d'image leur sont ajoutees automatiquement.

---

## Questions / Support

Un bug ? Une question sur l'installation ? Tu veux adapter Scrip a ta propre utilisation ?

- Ouvre une [issue GitHub](../../issues)
- Ou contacte-moi sur [gabizoc.fr](https://gabizoc.fr)

D'autres projets disponibles sur [gabizoc.fr](https://gabizoc.fr).
