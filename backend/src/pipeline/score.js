// backend/src/pipeline/score.js
//
// Score le niveau de français d'une transcription OCR/IA sur 100.
// Souple par conception : noms propres, termes techniques et abréviations
// ne sont pas pénalisés. Seuls les mots vraiment aberrants comptent.

import nspell from 'nspell';
import dicFr from 'dictionary-fr';

// dictionary-fr exporte directement { aff, dic } — pas de callback
let spellChecker = null;

function getSpeller() {
  if (!spellChecker) spellChecker = nspell(dicFr);
  return spellChecker;
}

/**
 * Retourne true si le mot peut être ignoré sans pénalité.
 * Très permissif pour couvrir les cas OCR/IA courants.
 */
function isIgnored(word) {
  // Chiffres, codes, dates
  if (/\d/.test(word)) return true;
  // Trop court (une lettre, deux lettres — articles, prépositions…)
  if (word.length <= 2) return true;
  // Sigles tout en majuscules (ZEE, DROM, PIB, UE…)
  if (/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]{2,}$/.test(word)) return true;
  // Noms propres (commence par une majuscule) — Rhône, Paris, Massif…
  if (/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]/.test(word)) return true;
  // Mots avec tiret composés — Nord-Est, socio-économique…
  if (word.includes('-')) return true;
  // URLs, chemins
  if (/^https?:|\//.test(word)) return true;
  // Syntaxe Markdown résiduelle
  if (/^[*_|`#>[\]()]+$/.test(word)) return true;
  // Abréviations avec point (ex., cf., etc.)
  if (/\.$/.test(word)) return true;
  return false;
}

/**
 * Extrait les mots "candidats" à la vérification depuis du Markdown.
 * Ne conserve que les mots minuscules, sans tiret, de longueur ≥ 3.
 */
function extractCandidates(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')          // commentaires HTML
    .replace(/```[\s\S]*?```/g, '')            // blocs de code
    .replace(/`[^`]*`/g, '')                   // code inline
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // liens Markdown
    .replace(/^\|[\s\-:|]+\|.*$/mg, '')        // séparateurs tableau
    .replace(/[^\wÀ-ÿœŒæÆ'\- ]/g, ' ')       // ponctuation → espace
    .split(/\s+/)
    .map(w => w.replace(/^['\-]+|['\-]+$/g, ''))
    .filter(w => w.length >= 3 && !isIgnored(w));
}

/**
 * Score le niveau de français d'une note sur 100.
 *
 * Logique souple pour OCR/IA :
 *  - Les noms propres, sigles, termes techniques, mots composés sont ignorés
 *  - Seuls les mots minuscules communs sont vérifiés
 *  - La pénalité est douce : 10 % d'erreurs → ~85/100 (pas ~50)
 *  - En dessous de 20 candidats vérifiables → score neutre 90
 *
 * @param {string} markdown - Contenu de la note (sans frontmatter)
 * @returns {Promise<{ score: number, errors: number, total: number, samples: string[] }>}
 */
export function scoreNote(markdown = '') {
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n*/m, '')
    .replace(/^```(?:markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/\n*<!--\s*METADATA[\s\S]*?-->\s*$/i, '')
    .trim();

  if (text.length < 20) {
    return { score: 0, errors: 0, total: 0, samples: [] };
  }

  const spell = getSpeller();
  const candidates = extractCandidates(text);
  const unique = [...new Set(candidates.map(w => w.toLowerCase()))];

  // Pas assez de mots vérifiables → score neutre (on ne pénalise pas l'incertitude)
  if (unique.length < 20) {
    return { score: 90, errors: 0, total: unique.length, samples: [] };
  }

  const wrong = unique.filter(w => !spell.correct(w));
  const errorRate = wrong.length / unique.length;

  // Formule douce : même 15 % d'erreurs reste > 70
  // score = 100 × (1 - errorRate × 0.8)  plafonné à [0, 100]
  const score = Math.round(100 * Math.max(0, 1 - errorRate * 0.8));

  const samples = wrong.slice(0, 6);

  process.stderr.write(
    `[score] ${score}/100 — ${wrong.length}/${unique.length} mots suspects` +
    (samples.length ? ` (ex: ${samples.join(', ')})` : '') + '\n'
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    errors: wrong.length,
    total: unique.length,
    samples,
  };
}
