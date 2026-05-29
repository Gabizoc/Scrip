//
// Formateur Markdown basé sur des règles — fallback quand le LLM hallucine.
// Principe : ne toucher QUE à la mise en forme, jamais au contenu.

/**
 * Supprime les blocs d'exercices du markdown produit par un modèle vision.
 *
 * Les exercices se reconnaissent à :
 *  - Un titre ## ou ### dont le numéro commence par un chiffre : ## 1), ## 2), ### 4a) …
 *  - Un contenu COURT (titre + corps ≤ 300 chars) : c'est une réponse, pas un développement
 *
 * Ne supprime PAS les sections ## N) dont le titre est long (> 120 chars) car le modèle
 * y a mis un paragraphe de cours entier (ex: ## 3) L'empire byzantin tire son pouvoir…).
 *
 * Stratégie : si 2+ sections numérotées courtes consécutives → retirer tout le bloc.
 * Si section numérotée longue → corriger le titre en ## (sans numéro) et garder.
 */
export function removeExerciseBlocks(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let current = null;
  let preamble = [];

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      if (current) sections.push(current);
      else if (preamble.length) sections.push({ headingLine: null, bodyLines: preamble });
      const headingText = m[2].trim();
      current = { headingLine: line, headingText, isNumbered: /^\d+[a-z]?\)\s*/.test(headingText), bodyLines: [] };
    } else if (current) {
      current.bodyLines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);

  // Critère exercice : titre numéroté (## N) / ### Na)) ET :
  //   - corps court (< 100 chars), OU
  //   - corps qui commence lui-même par un autre numéro N) (exercices consécutifs fusionnés)
  for (const sec of sections) {
    if (!sec.isNumbered) { sec.isExercise = false; continue; }
    const bodyText = sec.bodyLines.join('\n').replace(/\s+/g, ' ').trim();
    const firstBodyLine = sec.bodyLines.find(l => l.trim())?.trim() ?? '';
    const bodyStartsWithNumber = /^\d+[a-z]?\)\s*/.test(firstBodyLine);
    sec.isExercise = bodyText.length < 100 || bodyStartsWithNumber;
  }

  const result = [];
  let removed = 0;
  for (const sec of sections) {
    if (sec.isExercise) {
      removed++;
      process.stderr.write(`    [filter] exercice supprimé: "${sec.headingText.slice(0, 80)}"\n`);
      continue;
    }
    if (sec.headingLine) result.push(sec.headingLine);
    // Nettoyer les lignes de corps : supprimer le préfixe "N) " sur les paragraphes longs
    // (le modèle ajoute parfois un numéro d'exercice devant du contenu de cours)
    for (const line of sec.bodyLines) {
      const numPrefix = line.match(/^(\d+[a-z]?\)\s+)(.+)/);
      if (numPrefix && numPrefix[2].length > 80) {
        // Paragraphe long avec préfixe numérique parasite → retirer le préfixe
        process.stderr.write(`    [filter] préfixe numérique retiré: "${numPrefix[1].trim()}"\n`);
        result.push(numPrefix[2]);
      } else {
        result.push(line);
      }
    }
  }
  if (removed) process.stderr.write(`    [filter] ${removed} section(s) exercice supprimée(s)\n`);

  // Supprimer le titre dupliqué : si le 1er H1 est contenu dans le 2e H1, retirer le 1er
  const joined = result.join('\n');
  const deduped = removeDuplicateH1(joined);

  return deduped.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Supprime le premier # Titre si son texte est contenu dans le second # Titre.
 * Cas typique : "# La Méditerranée" suivi de "# I - La Méditerranée : ..."
 */
function removeDuplicateH1(markdown) {
  const lines = markdown.split('\n');
  const h1s = lines.map((l, i) => ({ line: l, i })).filter(({ line }) => /^# /.test(line));
  if (h1s.length < 2) return markdown;

  const t1 = h1s[0].line.replace(/^# /, '').trim().toLowerCase();
  const t2 = h1s[1].line.replace(/^# /, '').trim().toLowerCase();

  if (t2.includes(t1) || t1.includes(t2)) {
    process.stderr.write(`    [filter] titre H1 dupliqué supprimé: "${h1s[0].line.slice(0, 60)}"\n`);
    lines.splice(h1s[0].i, 1);
  }
  return lines.join('\n');
}

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
