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
    for (const line of sec.bodyLines) {
      const numPrefix = line.match(/^(\d+[a-z]?\)\s+)(.+)/);
      if (numPrefix && numPrefix[2].length > 80) {
        process.stderr.write(`    [filter] préfixe numérique retiré: "${numPrefix[1].trim()}"\n`);
        result.push(numPrefix[2]);
      } else {
        result.push(line);
      }
    }
  }
  if (removed) process.stderr.write(`    [filter] ${removed} section(s) exercice supprimée(s)\n`);

  const deduped = removeDuplicateH1(result.join('\n'));

  return deduped.replace(/\n{3,}/g, '\n\n').trim();
}

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

// Les modeles ecrivent souvent les fleches/symboles des notes en LaTeX ($\rightarrow$),
// illisible dans la PWA. On remplace les blocs $...$ qui ne contiennent QUE des symboles connus ;
// les vraies formules ($E = mc^2$) sont laissees telles quelles (Obsidian les rend).
const LATEX_SYMBOLS = {
  rightarrow: '→', to: '→', longrightarrow: '⟶', leftarrow: '←', gets: '←', longleftarrow: '⟵',
  leftrightarrow: '↔', Rightarrow: '⇒', implies: '⇒', Longrightarrow: '⟹', Leftarrow: '⇐',
  Leftrightarrow: '⇔', iff: '⇔', uparrow: '↑', downarrow: '↓', nearrow: '↗', searrow: '↘',
  mapsto: '↦', rightleftharpoons: '⇌',
  times: '×', cdot: '·', div: '÷', pm: '±', approx: '≈', simeq: '≃', sim: '~', neq: '≠', ne: '≠',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', ll: '≪', gg: '≫', infty: '∞', degree: '°', circ: '°',
  in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', lambda: 'λ', mu: 'μ',
  pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', theta: 'θ', omega: 'ω', Omega: 'Ω',
};

export function replaceSimpleLatex(markdown) {
  return markdown.replace(/\$\s*((?:\\[A-Za-z]+\s*)+)\$/g, (match, body) => {
    const cmds = body.trim().split(/\s+/).map(c => c.slice(1));
    if (!cmds.every(c => c in LATEX_SYMBOLS)) return match;
    return cmds.map(c => LATEX_SYMBOLS[c]).join(' ');
  });
}

export function applyRulesFormat(ocrText) {
  const lines = ocrText.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { out.push(''); continue; }

    if (/^#{1,3}\s/.test(trimmed)) { out.push(raw); continue; }
    if (/^[-*]{3,}$/.test(trimmed)) { out.push('***'); continue; }

    if (/^(I{1,3}V?|VI{0,3}|IX|X{1,3})\s*[-–—.:)\s]\s*.+/.test(trimmed)) {
      out.push(`# ${trimmed}`); continue;
    }

    if (/^[A-Z]\s*[).]\s*.+/.test(trimmed) && trimmed.length < 120) {
      out.push(`## ${trimmed}`); continue;
    }

    if (/^\d+\s*[).]\s*.+/.test(trimmed) && trimmed.length < 120) {
      out.push(`### ${trimmed}`); continue;
    }

    if (trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-ZÀÂÉÈÊËÎÏÔÙÛÜ]{3}/.test(trimmed)) {
      out.push(`## ${trimmed}`); continue;
    }

    if (/^[-*•]\s/.test(trimmed)) { out.push(raw); continue; }

    out.push(raw);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function significantWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zàâéèêëîïôùûüç\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4);
}

export function isOutputValid(reference, llmOutput, {
  minOverlap = 0.55,
  minRatio = 0.25,
  maxRatio = 1.4,
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

  const refWords = new Set(significantWords(reference));
  const llmWords = significantWords(llmOutput);

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
