// backend/src/pipeline/format-rules.js
//
// Formateur Markdown basé sur des règles — fallback quand le LLM hallucine.
// Principe : ne toucher QUE à la mise en forme, jamais au contenu.

/**
 * Applique une mise en forme Markdown minimale au texte OCR brut.
 * Aucun contenu n'est ajouté ou modifié.
 */
export function applyRulesFormat(ocrText) {
  const lines = ocrText.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { out.push(''); continue; }

    // Titres / séparateurs déjà en Markdown
    if (/^#{1,3}\s/.test(trimmed)) { out.push(raw); continue; }
    if (/^[-*]{3,}$/.test(trimmed)) { out.push('***'); continue; }

    // Grande partie : I, II, III… en tête de ligne
    if (/^(I{1,3}V?|VI{0,3}|IX|X{1,3})\s*[-–—.:)\s]\s*.+/.test(trimmed)) {
      out.push(`# ${trimmed}`); continue;
    }

    // Sous-partie : A), B)… ou A. B.
    if (/^[A-Z]\s*[).]\s*.+/.test(trimmed) && trimmed.length < 120) {
      out.push(`## ${trimmed}`); continue;
    }

    // Point numéroté : 1), 2)…
    if (/^\d+\s*[).]\s*.+/.test(trimmed) && trimmed.length < 120) {
      out.push(`### ${trimmed}`); continue;
    }

    // Ligne courte en majuscules = probablement un titre
    if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]{3}/.test(trimmed)) {
      out.push(`## ${trimmed}`); continue;
    }

    // Liste déjà formée (tiret, puce, *)
    if (/^[-*•]\s/.test(trimmed)) { out.push(raw); continue; }

    // Ligne ordinaire
    out.push(raw);
  }

  // Détecter et convertir les blocs tabulaires (lignes qui ressemblent à des cellules)
  const joined = out.join('\n');
  return joined.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Normalise un texte pour comparaison : minuscules, sans ponctuation, mots >= 4 lettres.
 */
function significantWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zàâéèêëîïôùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4);
}

/**
 * Valide la sortie LLM — retourne true si elle semble fidèle à la référence.
 *
 * @param {string} reference  - Texte de référence (OCR ou autre modèle)
 * @param {string} llmOutput  - Sortie à valider
 * @param {object} opts
 * @param {number} opts.minOverlap  - Seuil de recouvrement lexical (défaut 0.55)
 * @param {number} opts.minRatio    - Ratio longueur minimum (défaut 0.25)
 * @param {number} opts.maxRatio    - Ratio longueur maximum (défaut 1.4)
 */
export function isOutputValid(reference, llmOutput, {
  minOverlap = 0.55,
  minRatio   = 0.25,
  maxRatio   = 1.4,
} = {}) {
  if (!llmOutput || llmOutput.length < 50) {
    process.stderr.write(`    ⚠ VALIDATION: sortie trop courte ou vide → rejet\n`);
    return false;
  }

  const ratio = llmOutput.length / reference.length;

  if (ratio > maxRatio) {
    process.stderr.write(
      `    ⚠ VALIDATION: sortie trop longue (ratio ${ratio.toFixed(2)}x > ${maxRatio}) → rejet\n`
    );
    return false;
  }
  if (ratio < minRatio) {
    process.stderr.write(
      `    ⚠ VALIDATION: sortie trop courte (ratio ${ratio.toFixed(2)}x < ${minRatio}) → rejet\n`
    );
    return false;
  }

  const refWords  = new Set(significantWords(reference));
  const llmWords  = significantWords(llmOutput);

  if (refWords.size === 0) return true;

  const matchedCount = llmWords.filter(w => refWords.has(w)).length;
  const coverage = matchedCount / Math.max(llmWords.length, 1);

  if (coverage < minOverlap) {
    process.stderr.write(
      `    ⚠ VALIDATION: recouvrement ${(coverage * 100).toFixed(0)}% < seuil ${(minOverlap * 100).toFixed(0)}% → rejet\n`
    );
    const invented = [...new Set(llmWords.filter(w => !refWords.has(w)))].slice(0, 12);
    if (invented.length) process.stderr.write(`    Mots absents de la référence : ${invented.join(', ')}\n`);
    return false;
  }

  process.stderr.write(
    `    ✓ VALIDATION: ratio=${ratio.toFixed(2)}x, recouvrement=${(coverage * 100).toFixed(0)}% → OK\n`
  );
  return true;
}
