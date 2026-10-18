import { log } from '../lib/logger.js';
import nspell from 'nspell';
import dicFr from 'dictionary-fr';

let spellChecker = null;

function getSpeller() {
  if (!spellChecker) spellChecker = nspell(dicFr);
  return spellChecker;
}

function isIgnored(word) {
  if (/\d/.test(word)) return true;
  if (word.length <= 2) return true;
  if (/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]{2,}$/.test(word)) return true;
  if (/^[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]/.test(word)) return true;
  if (word.includes('-')) return true;
  if (/^https?:|\//.test(word)) return true;
  if (/^[*_|`#>[\]()]+$/.test(word)) return true;
  if (/\.$/.test(word)) return true;
  return false;
}

function extractCandidates(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\|[\s\-:|]+\|.*$/mg, '')
    .replace(/[^\wÀ-ÿœŒæÆ'\- ]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(w => w.length >= 3 && !isIgnored(w));
}

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

  if (unique.length < 20) {
    return { score: 90, errors: 0, total: unique.length, samples: [] };
  }

  const wrong = unique.filter(w => !spell.correct(w));
  const errorRate = wrong.length / unique.length;

  const score = Math.round(100 * Math.max(0, 1 - errorRate * 0.8));

  const samples = wrong.slice(0, 6);

  log.debug(
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
