# Home — Dossiers & Accès Rapide — Design Spec

**Date :** 2026-05-20  
**Statut :** Approuvé

---

## Objectif

Restructurer la page d'accueil (`/`) pour remplacer la grille plate filtrée par une interface à trois zones : bande de cours récents en scroll horizontal infini, sidebar de dossiers par matière, et zone principale avec toggle liste/cards.

## Architecture des zones

```
┌─────────────────────────────────────────────────────┐
│  ⚡ Récents  [pill][pill][pill][pill]  ···→ scroll   │
├──────────────┬──────────────────────────────────────┤
│  Sidebar     │  [Recherche]  [Tri ▾]  [☰ ⊞]        │
│  🗂 Tous 33  │                                       │
│  📜 Histoire │  📄 La Révolution…  Histoire  2j  98 │
│  🌍 Géo      │  📄 Les biomes      SVT        5j  91 │
│  🧬 SVT      │  📄 Mondialisation  Géo        1sem 72│
│  ⚖️ EMC      │  …                                   │
└──────────────┴──────────────────────────────────────┘
```

Sur mobile (`< md`) la sidebar devient une rangée de chips scrollables horizontalement, insérée entre la bande récents et le header de contenu.

---

## Zone 1 — Bande récents (`RecentStrip`)

- Affiche **tous** les cours triés par `createdAt` décroissant, pas seulement les N derniers.
- Chargement par **tranches de 8** : les 8 premiers sont rendus immédiatement, une sentinelle invisible est placée à l'extrémité droite du scroll.
- Un `IntersectionObserver` sur la sentinelle déclenche le chargement de 8 notes supplémentaires.
- Chaque **pill** contient : titre tronqué (max ~18 chars), dot coloré de la matière, score (coloré vert/orange/rouge).
- La hauteur est fixe (pas de wrap), overflow-x scroll, pas de scrollbar visible (`scrollbar-none`).
- Cliquer une pill navigue vers `/preview/:noteId`.
- Masqué si aucune note.

## Zone 2 — Sidebar matières (`SubjectSidebar`)

### Desktop (`md+`)
- Colonne fixe de **130px** à gauche de la zone de contenu (ne pousse pas le layout, position sticky).
- Premier item : **"Tous"** avec count total.
- Séparateur visuel, puis une entrée par matière : emoji/icône + nom + badge count.
- Item actif : fond `accent/18`, texte `accent`.
- Clic sur une entrée → met à jour `activeSubject` (état levé dans `Home`). `null` = Tous.

### Mobile (`< md`)
- La colonne disparaît.
- Une rangée de **chips scrollables** s'affiche entre la bande récents et le header du contenu principal.
- Même logique de sélection.

### Icônes des matières
Dérivées du nom de matière (hashage déterministe vers un emoji parmi une liste fixe). Pas de configuration manuelle.

## Zone 3 — Contenu principal

### Header
- **Titre** : nom du dossier actif ("Tous les cours" ou nom de la matière) + count filtré.
- **Barre de recherche** : filtre en temps réel sur `title` et `subject`. Bouton ✕ pour vider.
- **SortSelect** : tri parmi `date-desc` / `date-asc` / `score-desc` / `title-asc`.
- **Toggle vue** : deux boutons icône ☰ (liste) et ⊞ (cards). La vue active est persistée dans `localStorage` sous la clé `scrip-home-view`.

### Vue liste (☰) — file explorer
Tableau en display flex avec 4 colonnes :
| Colonne | Largeur | Contenu |
|---------|---------|---------|
| Titre   | flex-1  | icône 📄 + titre tronqué |
| Matière | 80px    | badge coloré (dot + nom) |
| Date    | 56px    | date relative (il y a Xj/sem/mois) |
| Score   | 48px    | `qualite_francais` coloré |

- Header de colonnes avec labels uppercase grisés.
- Ligne survolée : fond `white/4`.
- Clic sur une ligne → `/preview/:noteId`.

### Vue cards (⊞)
- Grille responsive identique à l'actuelle : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Utilise le composant `NoteCard` existant sans modification.

### Empty states
- Aucune note du tout → illustration + "Capture ton premier cours"
- Aucun résultat après filtre/recherche → "Aucun cours" + bouton "Effacer les filtres"

---

## État et props

Tout l'état est levé dans `Home` :

```js
const [activeSubject, setActiveSubject] = useState(null);   // null = Tous
const [search, setSearch]               = useState('');
const [sort, setSort]                   = useState('date-desc');
const [view, setView]                   = useState(                       // 'list' | 'cards'
  () => localStorage.getItem('scrip-home-view') ?? 'list'
);
```

`filtered` est un `useMemo` qui applique sujet + recherche + tri sur `notes`.

`subjects` est un `useMemo` dérivé de `notes` (comme actuellement) : `Map<name, count>[]` triés par count décroissant.

---

## Composants

### Nouveaux
- **`frontend/src/components/RecentStrip.jsx`** — bande récents scroll infini horizontal
- **`frontend/src/components/SubjectSidebar.jsx`** — sidebar desktop + chips mobile
- **`frontend/src/components/NoteListRow.jsx`** — une ligne de la vue liste

### Modifiés
- **`frontend/src/pages/Home.jsx`** — réécriture complète, orchestre les 3 zones

### Inchangés
- `NoteCard.jsx`, `api.js`, toutes les routes backend

---

## Comportement mobile

| Élément | Desktop (`md+`) | Mobile (`< md`) |
|---------|----------------|-----------------|
| Bande récents | En haut, pleine largeur | Identique |
| Sidebar | Colonne 130px fixe | Chips scrollables horizontalement |
| Vue liste | Toutes colonnes | Colonnes Date et Score masquées (`hidden md:flex`) |
| Vue cards | grid-cols-2+ | grid-cols-1 |

---

## Ce qui est supprimé

- Les chips de filtre par matière dans la `FilterBar` (remplacés par la sidebar)
- Les chips de filtre par score (supprimés per décision — épuré)
- Le composant `FilterBar` et `FiltersInline` (plus nécessaires)
- Le composant `Chip` dans Home (remplacé)

La barre de recherche et le tri restent, intégrés dans le header du contenu principal.
