// Apprend des corrections faites à la main sur une note : les mots remplacés par un mot
// proche (faute de lecture, pas réécriture) sont gardés par matière et rappelés au modèle
// lors des transcriptions suivantes.

const MAX_STORED = 200;
const MAX_IN_PROMPT = 40;
const MAX_DIFF_CELLS = 4_000_000;

// Diff LCS générique : renvoie une suite d'opérations { op: 'eq' | 'del' | 'ins', value }.
function diff(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > MAX_DIFF_CELLS) return null;

  const cols = midB.length + 1;
  const dp = new Uint32Array((midA.length + 1) * cols);
  for (let i = midA.length - 1; i >= 0; i--) {
    for (let j = midB.length - 1; j >= 0; j--) {
      dp[i * cols + j] = midA[i] === midB[j]
        ? dp[(i + 1) * cols + j + 1] + 1
        : Math.max(dp[(i + 1) * cols + j], dp[i * cols + j + 1]);
    }
  }

  const ops = [];
  let i = 0, j = 0;
  while (i < midA.length && j < midB.length) {
    if (midA[i] === midB[j]) { ops.push({ op: 'eq', value: midA[i] }); i++; j++; }
    else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) ops.push({ op: 'del', value: midA[i++] });
    else ops.push({ op: 'ins', value: midB[j++] });
  }
  while (i < midA.length) ops.push({ op: 'del', value: midA[i++] });
  while (j < midB.length) ops.push({ op: 'ins', value: midB[j++] });
  return ops;
}

// Regroupe les opérations en blocs { del: [...], ins: [...] } séparés par des parties communes.
function changeBlocks(ops) {
  const blocks = [];
  let cur = null;
  for (const { op, value } of ops) {
    if (op === 'eq') { cur = null; continue; }
    if (!cur) { cur = { del: [], ins: [] }; blocks.push(cur); }
    cur[op].push(value);
  }
  return blocks;
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const bare = (word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

function isReadingFix(from, to) {
  if (from.length < 3 || to.length < 3) return false;
  if (!/\p{L}/u.test(from) || !/\p{L}/u.test(to)) return false;
  const a = from.toLowerCase(), b = to.toLowerCase();
  if (a === b) return false;
  return levenshtein(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.4));
}

// Renvoie les paires { from, to } de mots corrigés entre deux versions d'une note.
export function extractCorrections(before, after) {
  const lineOps = diff(before.split('\n'), after.split('\n'));
  if (!lineOps) return [];

  const pairs = [];
  for (const block of changeBlocks(lineOps)) {
    if (!block.del.length || !block.ins.length) continue;
    const words = (lines) => lines.join(' ').split(/\s+/).filter(Boolean);
    const wordOps = diff(words(block.del), words(block.ins));
    if (!wordOps) continue;
    for (const { del, ins } of changeBlocks(wordOps)) {
      // Seuls les remplacements mot à mot (1 ou 2 mots) ressemblent à une faute de lecture.
      if (del.length !== ins.length || del.length > 2) continue;
      del.forEach((d, k) => {
        const from = bare(d), to = bare(ins[k]);
        if (isReadingFix(from, to)) pairs.push({ from, to });
      });
    }
  }
  return pairs;
}

export function recordCorrections(subject, pairs) {
  if (!pairs.length) return false;
  let list = subject.corrections ?? [];
  for (const { from, to } of pairs) {
    // Une correction annulée (retour au mot d'origine) efface l'entrée inverse.
    list = list.filter(c => !(c.from === to && c.to === from));
    const existing = list.find(c => c.from === from && c.to === to);
    if (existing) existing.count += 1;
    else list.push({ from, to, count: 1 });
  }
  subject.corrections = list.sort((a, b) => b.count - a.count).slice(0, MAX_STORED);
  return true;
}

export function topCorrections(subject) {
  return (subject.corrections ?? []).slice(0, MAX_IN_PROMPT);
}
