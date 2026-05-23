# CDC — Scrip (ingestor de cours manuscrits vers Obsidian)

> **Version 5.0** — mode clair/sombre/auto ajouté au MVP
> **Statut** : pipeline CLI fonctionnel, design system étendu (dual theme), UI à développer
> **Usager** : Gabi (auto-usage, niveau lycée)
> **Budget** : 0€

---

## 1. Vision

Outil personnel d'ingestion qui transforme une photo de cours manuscrit en note markdown structurée, automatiquement synchronisée vers un vault Obsidian. L'objectif est de réduire la friction entre "j'ai pris un cours en classe" et "j'ai une note propre, recherchable et liable dans mon système de prise de notes".

Le projet n'est pas un concurrent d'Obsidian. C'est un **ingestor** : il alimente le vault, Obsidian fait le reste (navigation, recherche, liens, plugins).

**Open source** : envisagé à très long terme, hors scope MVP.

## 2. Scope MVP

**Inclus :**
- Photo de cours manuscrit en entrée (PNG, JPG)
- OCR + structuration IA en deux étapes
- Génération markdown formaté avec frontmatter
- Découpe et insertion des zones non-textuelles comme images embarquées
- Audit log obligatoire pour corrections factuelles
- Métadonnées de qualité de français pour tracking longitudinal
- Sync automatique vers vault Obsidian via WebDAV
- 4 matières du tronc commun lycée
- Niveau scolaire configurable (1ère, Terminale, etc.)
- Interface mobile-first (PWA) + desktop (Tauri)
- **Thème sombre / clair / auto configurable**

**Exclu du MVP :**
- Explorateur de fichiers (Obsidian s'en charge)
- Système de templates personnalisables par l'utilisateur (codés en dur d'abord)
- Description IA des schémas et figures (risque d'hallucination)
- Multi-utilisateurs
- Modèles payants
- Dashboard de tracking qualité français (parking lot)

## 3. Matières au MVP

Quatre matières, format structurel commun, prompting système différencié :

- **Histoire** — frises chronologiques fréquentes, densité événementielle, dissertations
- **Géographie** — schémas territoriaux, cartes, vocabulaire spatial, tableaux typologiques
- **EMC** — volume réduit en lycée, notes courtes, débats
- **SVT** — schémas anatomiques et cellulaires denses, vocabulaire très technique

**Mutualisation des prompts** : histoire et géographie partagent le même prompt système (module `prompts/shs.js`) car le format pédagogique est identique. SVT et EMC auront leur propre prompt.

**Note ouverte** : au lycée, EMC a un volume horaire faible. À évaluer après quelques cycles d'utilisation si elle vaut le coup de garder son template dédié ou si elle peut être absorbée par un template générique.

**Post-MVP** : philosophie (Terminale), SES, langues, spécialités.

## 4. Pipeline d'architecture

```
[1] Capture photo (mobile PWA ou desktop Tauri)
       ↓
[2] Upload vers backend Node.js (serveur Debian)
       ↓
[3] OCR via Mistral OCR (API directe) → texte + bounding boxes
       ↓
[4] Découpe des zones non-textuelles → fichiers image (_assets/)
       ↓
[5] LLM #2 (Mistral Small via API directe) → structuration markdown + fact-check + évaluation français
       ↓
[6] Génération fichiers :
       - cours_titre.md (note principale + bloc METADATA HTML commenté)
       - _audit/cours_titre.audit.md (audit log si corrections factuelles)
       - _assets/cours_titre_schema_N.png (visuels embarqués)
       ↓
[7] Sync WebDAV → vault Obsidian (récupération via plugin Remotely Save)
```

## 5. Pipeline IA — deux modèles distincts

### Modèle #1 — OCR + détection de zones

**Choix : Mistral OCR (free tier, API directe)**

- Endpoint : API Mistral directe (pas via OpenRouter)
- Justification : meilleure qualité OCR manuscrit 2026, bounding boxes natives indispensables pour la stratégie A, free tier suffisant pour usage perso, pas de logging "training" comme sur OpenRouter
- Sortie : markdown brut + métadonnées de zones non-textuelles (coordonnées, type)

**Vérification à faire à l'inscription** : limites actuelles du free tier Mistral (variables dans le temps).

### Modèle #2 — Structuration markdown + fact-check + évaluation français

**Choix : Mistral Small (latest, API directe)**

- Provider : Mistral La Plateforme (free tier)
- Justification : stack unifiée avec Mistral OCR (une seule clé, une seule doc, un seul rate limit), excellent en français natif, ~128K contexte (largement suffisant pour un cours), pas de logging training
- Rôle : recevoir le markdown brut OCR + métadonnées matière/niveau, produire le markdown final structuré selon le template pédagogique, vérifier les faits historiques/scientifiques évidents, évaluer la qualité du français du texte brut

**Fallback : Google Gemma 4 26B A4B (free) via OpenRouter**

- ID : `google/gemma-4-26b-a4b-it:free`
- À activer si Mistral Small est retiré du free tier ou si la qualité de respect du format markdown est insuffisante après itération du prompt

### Politique de correction — révisée après premier test

**Corrections silencieuses autorisées** (pas d'audit log) :
- Orthographe, grammaire, accords, conjugaisons, syntaxe de l'élève
- Mots coupés en fin de ligne par tiret (recoller : "Fontaine-Fran-" + "çaise" → "Fontaine-Française")
- Ponctuation manquante ou incorrecte
- Reformulation légère pour fluidité, en gardant le sens exact

**Corrections tracées** (audit inline obligatoire) :
- Erreurs factuelles vérifiables : dates aberrantes, noms propres historiques erronés, événements mal datés
- Format : `[Note : "<original>" corrigé en "<corrigé>" — <raison concise>]`

**Politique d'incertitude** :
- Terme manifestement cassé sans hypothèse évidente : `[illisible : "<ce que l'OCR a lu>"]`
- Hypothèse contextuelle existante mais incertaine : `<hypothèse> [incertain — OCR : "<texte brut>"]`
- **Interdit** : halluciner un mot "plausible" sans signal d'incertitude

**Justification du choix** : l'usager (Gabi) accepte explicitement que sa grammaire et son orthographe soient nettoyées sans trace, car son tracking de niveau de français passe par les métadonnées de qualité (§ 7bis), pas par la lecture diff des corrections.

## 6. Stratégie visuels — Option A

Les zones non-textuelles détectées par Mistral OCR (schémas, figures, frises, cartes) sont :

1. Découpées du fichier source d'origine selon les bounding boxes
2. Sauvegardées dans `_assets/<nom-cours>_schema_<n>.png`
3. Référencées dans le markdown final via : `![Schéma N](_assets/<nom-cours>_schema_<n>.png)`

**Aucune description IA n'est générée pour ces zones.** Le risque d'hallucination est trop élevé sur des schémas complexes (SVT notamment). L'utilisateur voit l'image telle quelle, dans le contexte du markdown environnant.

## 7. Audit log — corrections factuelles uniquement

Chaque cours ingéré qui contient au moins une correction factuelle produit un fichier compagnon `_audit/<nom-cours>.audit.md` :

```markdown
# Audit — <titre du cours>

**Date d'ingestion** : <ISO timestamp>
**Modèle OCR** : Mistral OCR (free)
**Modèle structuration** : Mistral Small (free)

## Corrections factuelles appliquées

| Original (OCR) | Corrigé | Raison |
|----------------|---------|--------|
| "4589" | "1589" | Date impossible, assassinat d'Henri III par Jacques Clément |
| ... | ... | ... |

## Zones non-textuelles détectées

- Schéma 1 : `_assets/cours_titre_schema_1.png` (bounding box: x,y,w,h)
- ...
```

Si aucune correction factuelle n'est appliquée et qu'il n'y a pas de zones non-textuelles, ce fichier n'est pas créé.

## 7bis. Métadonnées qualité français

À la fin de chaque note `.md`, après le contenu, le LLM ajoute un bloc HTML commenté :

```html
<!-- METADATA
qualite_francais: 72
nb_fautes_orthographe: 5
nb_fautes_grammaire: 8
nb_fautes_syntaxe: 3
commentaire: "Syntaxe parfois maladroite, accords sujet-verbe à travailler."
-->
```

**Justification** : ce bloc :
- N'apparaît pas dans le rendu Obsidian (commentaire HTML)
- Reste parsable par un script futur pour agréger les données dans le temps
- Permet un tracking longitudinal de la progression sans polluer la note
- Évalue le texte **brut OCR** (avant corrections silencieuses), pas le markdown final

**Post-MVP** : dashboard de tracking (parking lot § 15).

## 8. Inputs utilisateur et configuration

### Inputs par cours
- Une ou plusieurs photos du cours
- Optionnel : override de matière (sinon détectée par IA)
- Optionnel : override de niveau (sinon : valeur courante des paramètres)

### Configuration globale (paramètres app)
- **Niveau scolaire actuel** : chaîne libre éditable (ex : "1ère", "Terminale", "Terminale spé NSI")
- **Vault Obsidian** : chemin distant WebDAV
- **Endpoint Mistral** : URL + clé API
- **Thème** : `dark` / `light` / `auto` (auto = suit la préférence système via `prefers-color-scheme`)

### Gestion du niveau dans le temps
- Le niveau actuel devient le nom du dossier racine dans le vault
- Bascule manuelle chaque année scolaire
- Redoublement : suffixe entre parenthèses → `Terminale (2)`
- Cours rétro-ajoutés à un ancien niveau : override par cours

## 9. Format markdown de sortie

### Structure hiérarchique
- **H1** : titre du cours (un seul, en début de note)
- **H2** : grandes parties, format "I- ...", "II- ...", "III- ..."
- **H3** : sous-parties, format "A) ...", "B) ...", "C) ..."
- **H4** : si granularité supplémentaire nécessaire

### Blocs liminaires
Si le cours contient une introduction et/ou une problématique, formater en gras (pas en titre) :

```markdown
**Introduction**
<texte de l'introduction>

**Problématique**
<texte de la problématique>
```

### Séparateurs
Insérer `***` sur une ligne seule entre les grandes parties (avant chaque H2 sauf le premier), avant la conclusion, et avant la section "Définitions" finale.

### Listes — style français
```markdown
- première puce ;
- deuxième puce ;
- dernière puce.
```

### Tableaux
Quand le contenu est typologique (comparaison de milieux, territoires, périodes), utiliser un tableau markdown plutôt qu'une liste imbriquée.

### Mise en gras
- **Termes-clés du programme** (notions, concepts, lois, événements majeurs) en gras à leur première occurrence
- Dates et noms propres : pas systématiquement en gras (sauf si centraux au paragraphe)

### Définitions
- Inline dans le corps : `**terme** : définition.`
- Bloc final "à apprendre" : section H2 "Définitions (à apprendre)" précédée d'un séparateur

### Frontmatter YAML
```yaml
---
matière: histoire
niveau: 1ère
date_cours: 2026-09-15
date_ingestion: 2026-09-15T18:42:00+02:00
tags: [cours, histoire, 1ere]
sources: [photo_01.jpg, photo_02.jpg]
---
```

### Bloc METADATA en fin de note
Voir § 7bis.

## 10. Sync — WebDAV + Remotely Save

### Côté serveur (Debian)
- Caddy ou Nginx avec WebDAV activé
- HTTPS obligatoire via Let's Encrypt (bug API Obsidian iOS sur HTTP brut)
- Authentification basique suffisante pour usage perso

### Côté client (Obsidian)
- Plugin **Remotely Save** configuré en WebDAV
- Sync au lancement et à intervalle régulier (paramétrable)

### Caveats acceptés
- Sync uniquement quand Obsidian est ouvert (pas de background sur iOS)
- Plugin Remotely Save lentement maintenu (~9 mois sans commit récent, ~150 issues ouvertes)
- Mitigation : **cron de backup quotidien** côté serveur, archive zippée du vault

## 11. Stack technique — verrouillée

### Frontend
- **React** (JSX)
- **Tailwind CSS** (avec stratégie `darkMode: 'class'` pour le toggle thème)
- **Motion** (ex-Framer Motion)
- **lucide-react** (icônes)

### Desktop
- **Tauri** (wrapper Windows / macOS / Linux)

### iOS
- **PWA uniquement** (pas d'app App Store, refus de la licence Apple Developer 99$/an)

### Backend
- **Node.js** sur serveur Debian self-hosté

### Sync
- **WebDAV** (Caddy ou Nginx + Let's Encrypt)
- **Remotely Save** côté Obsidian

### IA
- **Mistral OCR** (API directe, free tier) pour OCR + bounding boxes
- **Mistral Small** (API directe, free tier) pour structuration + fact-check + évaluation français
- **Gemma 4 26B A4B** (OpenRouter free) en fallback LLM

### Organisation des prompts
- `prompts/shs.js` — Histoire + Géographie (format pédagogique commun)
- `prompts/svt.js` — SVT (à créer)
- `prompts/emc.js` — EMC (à créer)

---

## 12. Système de design

### Principes directeurs

- **Mobile-first** : l'app est principalement utilisée sur téléphone pour la capture, donc tous les écrans sont conçus pour le pouce d'abord. Le desktop adapte, le mobile ne s'adapte pas du desktop.
- **Sérieux et silencieux** : l'outil disparaît, le contenu prime. Pas de surcharge visuelle, pas d'animations gratuites, pas de notifications inutiles.
- **Moderne, arrondi** : esthétique 2026, frosted glass inspiré du liquid glass d'Apple (sans les capacités OS natives), coins généreux.
- **Cohérence Obsidian** : palette sombre proche d'Obsidian pour que l'utilisateur ne sente pas de rupture entre les deux outils.
- **Dual theme** : sombre, clair, ou suivi automatique du système. Choix de l'utilisateur dans les paramètres.

### Limites techniques explicites — frosted glass vs liquid glass

L'esthétique cible est inspirée du **liquid glass** d'Apple (iOS 26 / macOS), mais l'app étant une PWA + Tauri, elle n'a pas accès au backdrop OS-level pour la vraie réfraction. L'implémentation se fait donc en **frosted glass CSS** :

- `backdrop-filter: blur()` — flou du fond ✅
- `backdrop-filter: saturate()` — boost de saturation ✅
- Bordure semi-transparente + highlight intérieur subtil ✅
- Gradient overlay très subtil ✅
- **Pas** de vraie réfraction/distorsion des pixels derrière

Visuellement très proche du liquid glass pour les layers de cartes empilés, suffisant pour donner l'identité moderne recherchée.

### Stratégie d'implémentation du thème

- **Tailwind config** : `darkMode: 'class'` (activation via classe `.dark` sur `<html>`)
- **State global** : préférence stockée en `localStorage` sous la clé `scrip.theme` avec trois valeurs possibles : `dark`, `light`, `auto`
- **Mode auto** : écoute du `MediaQueryList` de `prefers-color-scheme` et bascule la classe `.dark` en temps réel
- **Au chargement** : avant le render React, un script inline dans le HTML lit `localStorage` et applique la classe pour éviter le flash de thème

### Palette — mode sombre (défaut)

```
--bg-base        #0A0A0B   /* fond principal */
--bg-elevated    #141416   /* cartes, sheets */
--bg-glass       rgba(20, 20, 22, 0.6)  /* layers frosted */
--border-subtle  rgba(255, 255, 255, 0.06)
--border-glass   rgba(255, 255, 255, 0.1)

--text-primary   #ECECEE
--text-secondary #9A9AA0
--text-tertiary  #5A5A60

--accent         #7C7AFF
--accent-soft    rgba(124, 122, 255, 0.15)

--success        #5EE0A8
--warning        #F5C26B
--danger         #F47272
```

### Palette — mode clair

```
--bg-base        #FAFAFB   /* fond principal, blanc cassé */
--bg-elevated    #FFFFFF   /* cartes, sheets */
--bg-glass       rgba(255, 255, 255, 0.7)  /* layers frosted */
--border-subtle  rgba(10, 10, 12, 0.06)
--border-glass   rgba(10, 10, 12, 0.08)

--text-primary   #0A0A0B
--text-secondary #5A5A60
--text-tertiary  #9A9AA0

--accent         #6E6CE8   /* même violet, légèrement assombri pour contraste sur fond clair */
--accent-soft    rgba(110, 108, 232, 0.12)

--success        #2BA56F
--warning        #B97A1C
--danger         #C94545
```

**Justifications dual theme :**
- `#FAFAFB` au lieu de blanc pur : repose les yeux, cohérent avec `#0A0A0B` côté sombre (jamais l'extrême)
- L'accent reste violet sur les deux modes, mais légèrement assombri en clair pour garantir le ratio AA (4.5:1) sur fond blanc
- Statuts (success, warning, danger) repensés pour le mode clair : versions plus saturées et plus sombres pour rester lisibles

### Glass card — adaptations par thème

**Mode sombre** :
```css
background: rgba(20, 20, 22, 0.6);
backdrop-filter: blur(24px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow:
  0 1px 0 rgba(255, 255, 255, 0.05) inset,
  0 0 0 1px rgba(0, 0, 0, 0.2),
  0 8px 32px rgba(0, 0, 0, 0.4);
```

**Mode clair** :
```css
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(24px) saturate(180%);
border: 1px solid rgba(10, 10, 12, 0.08);
box-shadow:
  0 1px 0 rgba(255, 255, 255, 0.6) inset,
  0 0 0 1px rgba(10, 10, 12, 0.04),
  0 8px 32px rgba(10, 10, 12, 0.08);
```

Le highlight inset blanc devient plus opaque en mode clair pour préserver l'effet "verre éclairé par le dessus". L'ombre extérieure devient plus subtile (un fond clair tolère mal les ombres dures).

### Typographie

**Familles :**
- Principale : **Inter** (variable, Google Fonts)
- Mono : **JetBrains Mono** ou **Geist Mono** (métadonnées, dates ISO, code)
- Aucune serif dans l'UI (l'app reste sans-serif partout)

**Échelle :**
```
text-xs    11px  letter-spacing +0.02em
text-sm    13px
text-base  15px
text-lg    17px  letter-spacing -0.01em
text-xl    22px  letter-spacing -0.02em
text-2xl   28px  letter-spacing -0.03em
text-3xl   34px  letter-spacing -0.03em
```

### Rayons de courbure

```
--radius-sm    8px    /* boutons compacts, badges */
--radius-md    14px   /* boutons principaux, inputs */
--radius-lg    20px   /* cartes */
--radius-xl    28px   /* sheets, modales */
--radius-2xl   36px   /* hero cards, captures preview */
--radius-full  9999px /* boutons circulaires, FAB */
```

### Espacements

Échelle multiple de 4 (standard Tailwind) : `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`

Sur mobile : padding minimum 16px sur les bords d'écran, 20px à l'intérieur des cartes.

### Composants clés

**Bouton primaire**
```
height: 56px (pouce-friendly)
padding: 0 24px
border-radius: 14px
background: var(--accent)
color: <#0A0A0B en dark / #FFFFFF en light>
font-weight: 600
font-size: 15px
```

**FAB capture**
- Position : bottom-center, 24px du bord
- Taille : 72px × 72px
- Border-radius : 9999px
- Icon : lucide `Camera`, 28px

**Input texte**
- Mode sombre : `bg: rgba(255,255,255,0.04)`, `border: rgba(255,255,255,0.06)`
- Mode clair : `bg: rgba(10,10,12,0.03)`, `border: rgba(10,10,12,0.08)`
- Focus : `border: var(--accent) 40%`, `shadow: 0 0 0 4px var(--accent-soft)`

### Animations Motion

**Principe** : subtil et physique, pas de bounce caricatural.

```javascript
const spring = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 1
}

const screenTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
}

whileTap={{ scale: 0.96 }}
transition={{ duration: 0.1 }}
```

**Transition thème** : `transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease` sur tous les éléments concernés. Le toggle bascule donc smoothly et pas en flash.

### Flux mobile principal

**Écran 1 : Accueil** (liste cours récents)
- Header transparent qui blur le contenu au scroll (sticky glass header)
- Liste de cartes glass (un cours = une carte)
- FAB capture en bas

**Écran 2 : Capture**
- Plein écran caméra
- Overlay glass minimal en haut (matière auto-détectée, modifiable)
- Bouton capture rond 72px en bas
- Aucun chrome inutile

**Écran 3 : Preview post-ingestion**
- Sheet plein écran qui monte du bas (radius 28px en haut)
- Markdown rendu avec typo soignée
- Header glass collant avec actions (valider, retry, supprimer)

**Écran 4 : Paramètres**
- Liste de sections glass empilées
- Niveau scolaire, vault path, clés API, fallback model
- **Sélecteur de thème** : segmented control 3 options (Sombre / Clair / Auto), icônes lucide `Moon` / `Sun` / `Monitor`

### Tokens Tailwind config

```javascript
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent) / 0.15)',
        },
        status: {
          success: 'rgb(var(--success) / <alpha-value>)',
          warning: 'rgb(var(--warning) / <alpha-value>)',
          danger: 'rgb(var(--danger) / <alpha-value>)',
        },
      },
      borderRadius: {
        'sm': '8px',
        'md': '14px',
        'lg': '20px',
        'xl': '28px',
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
}
```

**CSS variables** définies dans `app.css` :

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

Cette approche par CSS variables avec Tailwind permet de changer toute la palette en basculant une classe sur `<html>`, sans dupliquer les classes utilitaires partout.

---

## 13. Risques et mitigations

| # | Risque | Impact | Mitigation |
|---|--------|--------|------------|
| R1 | OCR imparfait sur manuscrit cursif | Erreurs dans la note finale | Audit log obligatoire pour faits, métadonnées qualité pour tracking |
| R2 | Free tier Mistral épuisé en cours de session | Pipeline cassé | Monitoring usage, fallback Gemma 4 prêt à activer |
| R3 | Rate limits free tier | Batch lent en pic d'usage | Acceptable : ~5 cours/semaine = très loin des limites |
| R4 | Mistral Small retiré du free tier sans préavis | Pipeline cassé | Fallback Gemma 4 prêt à activer (changement d'1 ligne) |
| R5 | Sync WebDAV pas en background sur iOS | Note pas synchro tant qu'Obsidian fermé | Cron backup quotidien serveur, ouverture manuelle Obsidian régulière |
| R6 | Plugin Remotely Save plus maintenu à terme | Sync cassé à terme | Cron backup parallèle, recherche alternative quand le plugin casse |
| R7 | Hallucinations LLM sur fact-check | Information erronée injectée | Audit log obligatoire, prompts conservateurs, politique d'incertitude stricte |
| R8 | Hallucinations LLM sur récupération OCR (ex : "jure" → "durent") | Sens du texte altéré sans signal | Prompt système renforcé : interdiction de substituer un mot "plausible" sans audit |
| R9 | Sur-correction silencieuse perçue comme problème pédagogique | Faux souvenir du niveau de l'élève | Métadonnées qualité français (§ 7bis) compensent en gardant la trace numérique |
| R10 | Frosted glass mal rendu sur certains navigateurs / vieux devices | Dégradation visuelle | Fallback : fond opaque `bg-elevated` si `backdrop-filter` non supporté (feature query CSS) |
| R11 | Flash de thème au chargement (FOUC) | UX dégradée à l'ouverture | Script inline en `<head>` qui lit `localStorage` et applique `.dark` avant le render React |
| R12 | Ratio de contraste insuffisant en mode clair | Accessibilité réduite | Accent assombri en mode clair, statuts repensés, validation WCAG AA (4.5:1) sur tous les textes |

## 14. Critères de succès du MVP

- **Performance** : end-to-end < 60 secondes par cours photographié
- **Qualité OCR** : moins de 10% de cours nécessitant relecture lourde (> 5 corrections manuelles)
- **Qualité structuration** : format markdown conforme au template (§ 9) sur 95% des cours
- **Fiabilité sync** : moins de 3 incidents de sync par mois
- **Adoption** : utilisation effective sur au moins 80% des cours pris en classe sur un trimestre
- **Métadonnées qualité français** : présentes et parsables sur 100% des notes
- **UX mobile** : flux capture → preview en moins de 3 taps depuis l'accueil
- **Thème** : bascule sombre/clair/auto fluide, sans flash au chargement, contraste WCAG AA respecté sur les deux modes

## 15. Parking lot — post-MVP

- **Dashboard tracking qualité français** : script d'agrégation des blocs METADATA, visualisation de l'évolution dans le temps, par matière
- Description IA des schémas (avec garde-fous anti-hallucination)
- Templates utilisateur personnalisables par matière
- Matières additionnelles (philo, SES, langues, spécialités)
- Système multi-utilisateurs
- Open-source release (hors scope, très long terme)
- Mode "révision" : génération de fiches synthétiques à partir d'un mois de cours
- OCR vocale en complément (dictaphone pour cours magistraux)
- Détection automatique de doublons (même cours photographié deux fois)
- Versioning des notes (Git côté serveur)
- Thèmes personnalisés (au-delà des deux fournis)

---

## État du sprint

**✅ Fait :**
- Pipeline IA fonctionnel sur cours d'histoire
- Frontmatter YAML correct
- Détection matière OK
- Système de design arrêté (dark + light + auto)

**🔄 En cours :**
- Prompt système v2 (politique de correction révisée + format pédagogique + bloc METADATA)

**⏳ À venir :**
- Validation sur 3 cours réels (histoire + géographie) après itération du prompt
- Implémentation UI mobile (composants glass dual theme, écran capture, preview)
- Système de bascule de thème avec CSS variables + localStorage
- Backend Node + sync WebDAV
- Wrapper Tauri / PWA

---

*Document autoportant. Intégrable directement dans le vault Obsidian.*