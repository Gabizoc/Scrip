import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, ImagePlus, X, Pencil, Check } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import Button from '../../components/Button.jsx';
import Dropdown from '../../components/Dropdown.jsx';
import SubjectIcon from '../../components/SubjectIcon.jsx';
import { subjectIcon } from '../../lib/noteUtils.js';

const PROMPT_OPTIONS = ['default'];
const EMPTY_FORM = { name: '', levelId: '', prompt: 'default', outputFolder: '', emoji: '', color: '' };

// Palette de couleurs prédéfinies
const COLOR_PALETTE = [
  '#6e6ce8', '#60a5fa', '#34d399', '#f59e0b',
  '#f472b6', '#22d3ee', '#f87171', '#a78bfa',
  '#4ade80', '#fb923c', '#e879f9', '#94a3b8',
];

// ── Base d'emojis (sans doublons) ────────────────────────────────────────────
const EMOJI_DATA = [
  // Histoire
  { e: '📜', k: 'histoire document parchemin texte ancien' },
  { e: '🏛️', k: 'histoire antiquité rome grèce architecture temple' },
  { e: '🏺', k: 'histoire antiquité archéologie vase poterie' },
  { e: '⚔️', k: 'histoire guerre médiéval chevalier combat épée' },
  { e: '👑', k: 'histoire roi royauté monarchie couronne empire' },
  { e: '🏰', k: 'histoire château fort médiéval moyen âge' },
  { e: '🗿', k: 'histoire archéologie monument sculpture statue' },
  { e: '🧭', k: 'histoire exploration navigation géographie' },
  { e: '⛵', k: 'histoire navigation mer exploration colonisation' },
  { e: '🕌', k: 'histoire islam religion architecture mosquée' },
  { e: '⛪', k: 'histoire christianisme religion église cathédrale' },
  { e: '🛕', k: 'histoire religion temple asie' },
  { e: '🏴', k: 'histoire révolution drapeau nation état' },
  { e: '📯', k: 'histoire médiéval annonce proclamation' },
  { e: '🪖', k: 'histoire guerre soldats armée militaire' },
  { e: '💣', k: 'histoire guerre mondiale conflit bombardement' },
  { e: '🕊️', k: 'histoire paix traité diplomatie' },
  // Géographie
  { e: '🌍', k: 'géographie monde terre planète globe europe afrique' },
  { e: '🌎', k: 'géographie monde amériques globe planète' },
  { e: '🌏', k: 'géographie monde asie océanie globe planète' },
  { e: '🗺️', k: 'géographie carte monde atlas planisphère' },
  { e: '🌐', k: 'géographie monde international mondialisation' },
  { e: '🌊', k: 'géographie mer océan eau littoral' },
  { e: '⛰️', k: 'géographie montagne massif relief altitude' },
  { e: '🏔️', k: 'géographie montagne neige sommet alpes' },
  { e: '🌋', k: 'géographie géologie volcan svt éruption' },
  { e: '🏜️', k: 'géographie désert aride sahara climat' },
  { e: '🌲', k: 'géographie forêt nature svt arbre bois' },
  { e: '🌾', k: 'géographie agriculture campagne rural céréales' },
  { e: '🏙️', k: 'géographie ville urbain métropole urbanisation' },
  { e: '🌵', k: 'géographie désert cactus aride végétation' },
  { e: '🏝️', k: 'géographie île côte mer tropique' },
  { e: '🌡️', k: 'géographie physique température climat météo' },
  // Français / Lettres / Langues
  { e: '📖', k: 'français lecture livre littérature roman texte' },
  { e: '📝', k: 'français rédaction écriture notes dissertation' },
  { e: '✍️', k: 'français écriture rédaction manuscrit' },
  { e: '💬', k: 'langues communication expression oral dialogue' },
  { e: '🗣️', k: 'langues oral expression discours débat' },
  { e: '📚', k: 'cours livres études bibliothèque lectures' },
  { e: '🖊️', k: 'écriture stylo notes français bic' },
  { e: '✏️', k: 'crayon écriture cours annotation' },
  { e: '🗞️', k: 'presse journal médias information actualité' },
  { e: '🎤', k: 'oral expression langues micro prise de parole' },
  { e: '🖋️', k: 'écriture plume littérature auteur manuscrit' },
  { e: '📰', k: 'presse journal médias article presse écrite' },
  { e: '🔡', k: 'langues alphabet lettres grammaire' },
  { e: '🇫🇷', k: 'français france langue francophone' },
  { e: '🇬🇧', k: 'anglais english royaume-uni langue' },
  { e: '🇩🇪', k: 'allemand deutsch allemagne langue' },
  { e: '🇪🇸', k: 'espagnol español espagne langue' },
  // SVT / Biologie
  { e: '🔬', k: 'svt biologie sciences microscope labo observation' },
  { e: '🧬', k: 'svt biologie génétique adn molécule hérédité' },
  { e: '🌱', k: 'svt biologie plante nature croissance végétal' },
  { e: '🌿', k: 'svt biologie plante herbe nature botanique' },
  { e: '🦋', k: 'svt biologie insecte nature animal métamorphose' },
  { e: '🐠', k: 'svt biologie animal poisson océan faune marine' },
  { e: '🦁', k: 'svt biologie animal faune mammifère savane' },
  { e: '🌺', k: 'svt biologie fleur botanique reproduction' },
  { e: '🍎', k: 'svt nutrition santé alimentation digestion' },
  { e: '🧠', k: 'svt biologie cerveau intelligence neurosciences système nerveux' },
  { e: '🦠', k: 'svt biologie microbe bactérie virus microbiologie' },
  { e: '🧫', k: 'svt biologie labo culture cellulaire boîte petri' },
  { e: '🦴', k: 'svt biologie anatomie squelette os corps humain' },
  { e: '🫀', k: 'svt biologie anatomie cœur cardiaque circulation' },
  { e: '🫁', k: 'svt biologie anatomie poumons respiration' },
  { e: '🌍', k: 'svt écologie environnement planète biodiversité' },
  // Physique-Chimie
  { e: '⚗️', k: 'chimie physique sciences labo expérience fiole' },
  { e: '🧪', k: 'chimie physique sciences test tube tube à essai' },
  { e: '🔭', k: 'physique astronomie espace étoiles lunette' },
  { e: '⚡', k: 'physique électricité énergie foudre courant' },
  { e: '🧲', k: 'physique magnétisme aimant champ magnétique' },
  { e: '☢️', k: 'physique nucléaire radioactivité atome uranium' },
  { e: '💧', k: 'physique chimie eau liquide état molécule' },
  { e: '🔥', k: 'physique chimie feu chaleur énergie combustion' },
  { e: '🌞', k: 'physique astronomie soleil énergie rayonnement' },
  { e: '🪐', k: 'physique astronomie planète espace système solaire' },
  { e: '⚛️', k: 'physique chimie atome noyau particule quantique' },
  { e: '🔋', k: 'physique énergie pile électricité stockage' },
  { e: '🌈', k: 'physique optique lumière spectre couleurs' },
  { e: '💎', k: 'chimie minéraux cristaux structure matière' },
  { e: '🧊', k: 'physique chimie glace état solide changement' },
  // Maths
  { e: '🔢', k: 'maths mathématiques chiffres calcul nombre entier' },
  { e: '📐', k: 'maths mathématiques géométrie triangle équerre' },
  { e: '📏', k: 'maths mathématiques mesure règle longueur' },
  { e: '🧮', k: 'maths mathématiques calcul boulier arithmétique' },
  { e: '♾️', k: 'maths mathématiques infini limite analyse' },
  { e: '📊', k: 'maths statistiques graphique probabilités données' },
  { e: '📉', k: 'maths statistiques graphique fonction décroissance' },
  { e: '🧩', k: 'maths logique puzzle réflexion démonstration' },
  { e: '🔣', k: 'maths symboles formules algèbre notation' },
  // Philo / SES / Droit / EMC
  { e: '⚖️', k: 'philo droit justice balance équité tribunal' },
  { e: '🤔', k: 'philo philosophie réflexion pensée doute Descartes' },
  { e: '💡', k: 'philo idée réflexion innovation concept' },
  { e: '💰', k: 'ses économie argent finance monnaie richesse' },
  { e: '🏦', k: 'ses économie banque finance institution crédit' },
  { e: '🤝', k: 'ses social droit accord contrat cohésion' },
  { e: '🗳️', k: 'ses emc politique démocratie vote élection' },
  { e: '📈', k: 'ses économie croissance graphique pib indicateur' },
  { e: '🌐', k: 'ses mondialisation international échanges commerce' },
  { e: '🏛️', k: 'ses droit institutions état pouvoir politique' },
  { e: '🧾', k: 'ses économie facture consommation marché' },
  { e: '🪙', k: 'ses économie monnaie euro devise finance' },
  { e: '🕊️', k: 'emc paix citoyenneté droits valeurs' },
  // Arts plastiques / Musique / Cinéma
  { e: '🎨', k: 'arts peinture dessin créatif couleur atelier' },
  { e: '🖌️', k: 'arts peinture dessin pinceau technique' },
  { e: '🎭', k: 'théâtre arts spectacle masque comédie tragédie' },
  { e: '🎵', k: 'musique son art note solfège mélodie' },
  { e: '🎸', k: 'musique guitare instrument rock cordes' },
  { e: '🎹', k: 'musique piano instrument clavier classique' },
  { e: '🎺', k: 'musique trompette cuivre instrument jazz' },
  { e: '🎷', k: 'musique saxophone jazz instrument vent' },
  { e: '🥁', k: 'musique batterie percussions rythme' },
  { e: '🎼', k: 'musique partition solfège composition' },
  { e: '🎬', k: 'cinéma arts spectacle vidéo film réalisateur' },
  { e: '🖼️', k: 'arts peinture musée tableau toile exposition' },
  { e: '🪗', k: 'musique accordéon folk instrument traditionnel' },
  // EPS / Sport
  { e: '🏃', k: 'eps sport course athlétisme running sprint' },
  { e: '⚽', k: 'eps sport foot football ballon équipe' },
  { e: '🏊', k: 'eps sport natation piscine eau nage' },
  { e: '🏋️', k: 'eps sport musculation force haltérophilie' },
  { e: '🤸', k: 'eps sport gym gymnastique acrobatie' },
  { e: '🚴', k: 'eps sport vélo cyclisme endurance' },
  { e: '🎾', k: 'eps sport tennis raquette balle' },
  { e: '🏀', k: 'eps sport basket basketball panier' },
  { e: '🥊', k: 'eps sport boxe combat frappe' },
  { e: '🏄', k: 'eps sport surf vague mer glisse' },
  { e: '🤾', k: 'eps sport handball équipe collectif' },
  { e: '🥋', k: 'eps sport judo arts martiaux combat' },
  { e: '🏹', k: 'eps sport tir arc précision' },
  { e: '⛷️', k: 'eps sport ski neige montagne glisse' },
  { e: '🤺', k: 'eps sport escrime duel fleuret' },
  { e: '🏐', k: 'eps sport volley-ball filet équipe' },
  { e: '🏈', k: 'eps sport rugby américain ballon ovale' },
  // Informatique / NSI / Technologie
  { e: '💻', k: 'informatique nsi technologie code ordinateur laptop' },
  { e: '🖥️', k: 'informatique nsi ordinateur desktop bureau' },
  { e: '🤖', k: 'informatique ia robot intelligence artificielle algorithme' },
  { e: '💾', k: 'informatique données stockage disque base' },
  { e: '⚙️', k: 'technologie mécanique ingénierie paramètre système' },
  { e: '🔧', k: 'technologie réparation outil maintenance' },
  { e: '🏗️', k: 'technologie construction ingénierie architecture projet' },
  { e: '📱', k: 'informatique mobile téléphone application numérique' },
  { e: '🖱️', k: 'informatique souris interface utilisateur' },
  { e: '⌨️', k: 'informatique clavier saisie programmation' },
  { e: '📡', k: 'informatique réseau signal communication satellite' },
  { e: '🔐', k: 'informatique sécurité cryptographie protection données' },
  { e: '🛰️', k: 'informatique physique satellite espace technologie' },
  // Général scolaire
  { e: '🎓', k: 'école cours diplôme université lycée bac' },
  { e: '🔑', k: 'clé important notion essentiel à retenir' },
  { e: '🔍', k: 'recherche analyse examen méthode étude' },
  { e: '📌', k: 'important note épingle mémo' },
  { e: '🏆', k: 'réussite succès champion premier prix' },
  { e: '⭐', k: 'important essentiel excellence étoile' },
  { e: '🎯', k: 'objectif but cible précision résultat' },
  { e: '🌸', k: 'nature printemps fleur esthétique art' },
  { e: '🍀', k: 'nature chance svt environnement' },
  { e: '💯', k: 'excellent parfait résultat score note' },
  { e: '📣', k: 'communication annonce oral expression' },
  { e: '🗂️', k: 'organisation classeur dossier fichier rangement' },
  { e: '🧾', k: 'liste fiche mémo récapitulatif résumé' },
];

// ── Resize image ─────────────────────────────────────────────────────────────
function resizeImageToDataURL(file, size = 48) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx  = (img.width  - min) / 2;
      const sy  = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = url;
  });
}

// ── Popover picker — rendu via portal dans document.body ─────────────────────
function EmojiPickerPopover({ value, onChange, onClose, anchorRect }) {
  const ref     = useRef(null);
  const fileRef = useRef(null);
  const [search, setSearch] = useState('');

  // Ferme sur clic extérieur ou scroll de la page (pas du popover lui-même)
  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    function onScroll(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const filtered = search.trim()
    ? EMOJI_DATA.filter(({ e, k }) => k.includes(search.toLowerCase()) || e === search.trim())
    : EMOJI_DATA;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImageToDataURL(file, 48);
    onChange(dataUrl);
    onClose();
  }

  // Calcule la position : en dessous ou au dessus du bouton
  const POPOVER_H = 320; // hauteur estimée
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const goUp = spaceBelow < POPOVER_H && anchorRect.top > POPOVER_H;
  const top  = goUp
    ? anchorRect.top  + window.scrollY - POPOVER_H - 6
    : anchorRect.bottom + window.scrollY + 6;
  const left = Math.min(
    anchorRect.left + window.scrollX,
    window.innerWidth - 308,   // évite de sortir à droite
  );

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: goUp ? 'auto' : anchorRect.bottom + 6, bottom: goUp ? window.innerHeight - anchorRect.top + 6 : 'auto', left: Math.min(anchorRect.left, window.innerWidth - 308), zIndex: 9999 }}
      className="dropdown-panel rounded-xl w-[300px] overflow-hidden"
    >
      {/* Barre de recherche */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
        <Search size={13} className="text-text-tertiary shrink-0" />
        <input
          autoFocus
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un emoji…"
          className="flex-1 text-[13px] bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Grille */}
      <div className="px-2 py-2 max-h-52 overflow-y-auto [scrollbar-width:thin]">
        {filtered.length === 0 ? (
          <p className="text-center text-[12px] text-text-tertiary py-4">Aucun résultat</p>
        ) : (
          <div className="grid grid-cols-10 gap-0.5">
            {filtered.map(({ e }) => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); onClose(); }}
                className={[
                  'w-[26px] h-[26px] text-[16px] flex items-center justify-center rounded-md',
                  'transition-transform hover:scale-125 hover:bg-black/[0.05] dark:hover:bg-white/[0.07]',
                  value === e ? 'bg-accent/15 ring-1 ring-accent/40 scale-110' : '',
                ].join(' ')}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-black/[0.06] dark:border-white/[0.07]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-accent/10"
        >
          <ImagePlus size={13} />
          Image personnalisée
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); onClose(); }}
            className="ml-auto text-[11px] text-text-tertiary hover:text-status-danger transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
          >
            <X size={11} /> Réinitialiser
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Bouton icône cliquable ────────────────────────────────────────────────────
function EmojiButton({ value, name, onChange }) {
  const [anchorRect, setAnchorRect] = useState(null);
  const btnRef = useRef(null);

  function handleClick() {
    if (anchorRect) { setAnchorRect(null); return; }
    if (btnRef.current) setAnchorRect(btnRef.current.getBoundingClientRect());
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        title="Changer l'icône"
        className="w-10 h-10 rounded-lg flex items-center justify-center
          bg-black/[0.03] dark:bg-white/[0.04]
          border border-black/[0.08] dark:border-white/[0.06]
          hover:border-accent/40 transition-colors select-none overflow-hidden"
      >
        {value?.startsWith('data:') ? (
          <img src={value} alt="" className="w-8 h-8 rounded object-cover" />
        ) : (
          <span className="text-xl leading-none">{value || subjectIcon(name, null)}</span>
        )}
      </button>
      {anchorRect && (
        <EmojiPickerPopover
          value={value}
          anchorRect={anchorRect}
          onChange={onChange}
          onClose={() => setAnchorRect(null)}
        />
      )}
    </>
  );
}

// ── Petit champ texte inline ──────────────────────────────────────────────────
function InlineField({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 px-2.5 rounded-md text-[13px]
          bg-black/[0.04] dark:bg-white/[0.05]
          border border-black/[0.08] dark:border-white/[0.07]
          text-text-primary placeholder:text-text-tertiary
          focus:outline-none focus:border-accent/40 transition-colors"
      />
    </div>
  );
}

// ── Sélecteur de couleur ──────────────────────────────────────────────────────
function ColorPickerField({ value, onChange }) {
  const colorInputRef = useRef(null);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">Couleur</label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLOR_PALETTE.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value === c ? '' : c)}
            title={c}
            className={[
              'w-5 h-5 rounded-full transition-transform shrink-0',
              'hover:scale-110 focus:outline-none',
              value === c ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900 scale-110' : '',
            ].join(' ')}
            style={{ background: c, '--tw-ring-color': c }}
          />
        ))}
        {/* Bouton custom color */}
        <button
          type="button"
          title="Couleur personnalisée"
          onClick={() => colorInputRef.current?.click()}
          className={[
            'w-5 h-5 rounded-full border-2 border-dashed border-black/20 dark:border-white/20',
            'flex items-center justify-center text-[9px] text-text-tertiary hover:border-accent/60 transition-colors shrink-0',
            value && !COLOR_PALETTE.includes(value) ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900' : '',
          ].join(' ')}
          style={value && !COLOR_PALETTE.includes(value) ? { background: value + '44', ringColor: value } : {}}
        >
          +
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={value || '#6e6ce8'}
          onChange={e => onChange(e.target.value)}
          className="sr-only"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Retirer la couleur"
            className="text-[10px] text-text-tertiary hover:text-status-danger transition-colors ml-1"
          >
            <X size={11} />
          </button>
        )}
        {value && (
          <span className="text-[10px] text-text-tertiary font-mono">{value}</span>
        )}
      </div>
    </div>
  );
}

// ── Carte matière (lecture + édition inline) ──────────────────────────────────
function SubjectCard({ subject, levels, onPatch, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({});

  function startEdit() {
    setDraft({ name: subject.name, outputFolder: subject.outputFolder, prompt: subject.prompt, emoji: subject.emoji ?? '', color: subject.color ?? '' });
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); }
  function save() {
    onPatch(subject.id, draft);
    setEditing(false);
  }

  const df = k => v => setDraft(d => ({ ...d, [k]: v }));
  const level = levels.find(l => l.id === subject.levelId);
  const dropdownClass = 'h-8 px-2.5 rounded-md text-[13px] bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.07] text-text-primary';

  return (
    <GlassCard className="px-4 py-3">
      {/* ── Ligne principale (toujours visible) ── */}
      <div className="flex items-center gap-3">
        <EmojiButton
          value={editing ? draft.emoji : (subject.emoji ?? '')}
          name={editing ? draft.name : subject.name}
          onChange={v => editing ? df('emoji')(v) : onPatch(subject.id, { emoji: v })}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {subject.color && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: subject.color }}
              />
            )}
            <p className="text-[15px] font-medium text-text-primary truncate">{subject.name}</p>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">
            {level?.name ?? '·'} · {subject.prompt} · {subject.outputFolder}
          </p>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
            title="Modifier"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(subject.id)}
          className="p-1.5 rounded-md text-text-tertiary hover:text-status-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Zone d'édition inline ── */}
      {editing && (
        <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
          <InlineField label="Nom" value={draft.name} onChange={df('name')} placeholder="ex : Histoire" />
          <InlineField label="Dossier de sortie" value={draft.outputFolder} onChange={df('outputFolder')} placeholder="ex : Histoire" />
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">Prompt IA</label>
            <Dropdown
              value={draft.prompt}
              onChange={df('prompt')}
              options={PROMPT_OPTIONS.map(p => ({ value: p, label: p }))}
              fullWidth
              className={dropdownClass}
            />
          </div>
          <ColorPickerField value={draft.color ?? ''} onChange={df('color')} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={!draft.name || !draft.outputFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium
                bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={13} /> Enregistrer
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 rounded-md text-[12px] text-text-secondary
                hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SubjectsManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterLevelId, setFilterLevelId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: levels = [] }   = useQuery({ queryKey: ['levels'],   queryFn: api.getLevels });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', filterLevelId],
    queryFn: () => api.getSubjects(filterLevelId || undefined),
  });

  const create = useMutation({
    mutationFn: () => api.createSubject(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); setForm(EMPTY_FORM); },
    onError: e => alert(e.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, data }) => api.patchSubject(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const del = useMutation({
    mutationFn: api.deleteSubject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
    onError: e => alert(e.message),
  });

  const field = k => v => setForm(f => ({ ...f, [k]: v }));
  const dropdownClass = 'h-12 px-4 rounded-md text-[15px] bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.06] text-text-primary';

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Paramètres
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Matières</h1>

      <div className="space-y-3">
        <Dropdown
          value={filterLevelId}
          onChange={setFilterLevelId}
          options={[{ value: '', label: 'Tous les niveaux' }, ...levels.map(l => ({ value: l.id, label: l.name }))]}
          fullWidth
          className={dropdownClass.replace('h-12', 'h-10')}
        />

        {subjects.map(s => (
          <SubjectCard
            key={s.id}
            subject={s}
            levels={levels}
            onPatch={(id, data) => patch.mutate({ id, data })}
            onDelete={id => del.mutate(id)}
          />
        ))}

        {subjects.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-6">
            Aucune matière{filterLevelId ? ' pour ce niveau' : ''}.
          </p>
        )}

        {/* Formulaire création */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Nouvelle matière</h3>

          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Icône</label>
              <EmojiButton
                value={form.emoji}
                name={form.name}
                onChange={v => setForm(f => ({ ...f, emoji: v }))}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Nom</label>
              <input
                type="text"
                value={form.name}
                onChange={e => field('name')(e.target.value)}
                placeholder="ex : Histoire"
                className="h-12 px-4 rounded-md text-[15px]
                  bg-black/[0.03] dark:bg-white/[0.04]
                  border border-black/[0.08] dark:border-white/[0.06]
                  text-text-primary placeholder:text-text-tertiary
                  focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Niveau</label>
            <Dropdown
              value={form.levelId}
              onChange={field('levelId')}
              options={levels.map(l => ({ value: l.id, label: l.name }))}
              placeholder="Choisir un niveau"
              fullWidth
              className={dropdownClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Prompt IA</label>
            <Dropdown
              value={form.prompt}
              onChange={field('prompt')}
              options={PROMPT_OPTIONS.map(p => ({ value: p, label: p }))}
              fullWidth
              className={dropdownClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Dossier de sortie</label>
            <input
              type="text"
              value={form.outputFolder}
              onChange={e => field('outputFolder')(e.target.value)}
              placeholder="ex : Histoire"
              className="h-12 px-4 rounded-md text-[15px]
                bg-black/[0.03] dark:bg-white/[0.04]
                border border-black/[0.08] dark:border-white/[0.06]
                text-text-primary placeholder:text-text-tertiary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-text-secondary">Couleur</label>
            <ColorPickerField value={form.color} onChange={v => setForm(f => ({ ...f, color: v }))} />
          </div>

          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={!form.name || !form.levelId || !form.outputFolder || create.isPending}
          >
            Ajouter
          </Button>
        </GlassCard>
      </div>
    </div>
  );
}
