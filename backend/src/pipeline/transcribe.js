import { log } from '../lib/logger.js';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE } from '../../prompts/default.js';
import { isOutputValid, applyRulesFormat, removeExerciseBlocks } from './format-rules.js';

// L'analyse se fait en deux passes :
//   1. transcription : le modèle vision ne fait que lire les photos, mot pour mot ;
//   2. structuration : un appel texte met cette transcription en Markdown avec le prompt de la matière.
// Séparer les deux laisse le modèle vision entièrement concentré sur le déchiffrage.

const EXERCISE_MARKER = '[exercice]';

const TRANSCRIPTION_PROMPT = `Tu es un moteur de transcription de notes de cours manuscrites en français.
Ton seul travail : recopier fidèlement ce qui est écrit sur les photos. La mise en forme sera faite ensuite par un autre outil.

LECTURE :
- Recopie chaque mot exactement comme il est écrit, ligne par ligne, dans l'ordre de lecture
- Recopie les titres MOT POUR MOT avec leur numérotation (I -, A), 1), a)…), chacun sur sa propre ligne
- Garde les abréviations, flèches et symboles tels quels (ex : "ds", "tjrs", "→", "≠")
- Ne corrige pas l'orthographe, ne reformule pas, ne résume pas, n'ajoute rien de tes connaissances
- Mot douteux : écris ta meilleure lecture suivie de [?] (ex : "cytoplasme[?]")
- Mot impossible à lire : écris [illisible]
- Ignore le texte barré
- Texte encadré, souligné ou surligné : entoure-le de ** **
- Schémas et dessins : recopie seulement les mots écrits dedans (légendes, annotations)

TABLEAUX : reproduis-les en Markdown.
- Compte d'abord le nombre exact de colonnes en regardant les séparateurs verticaux
- Le header et chaque ligne ont EXACTEMENT ce nombre de cellules
- Si la 1ère colonne n'a pas de titre écrit → header vide : |  |
- Cellule vide → |  | ; cellule illisible → [illisible]

ZONES D'EXERCICES : le cahier mélange cours et exercices. Remplace chaque zone d'exercices par une seule ligne "${EXERCISE_MARKER}" et ne recopie pas son contenu.
▸ Signal principal : la zone est encadrée par deux traits horizontaux au stylo, un avant et un après.
▸ Signal textuel : réponses courtes numérotées 1) … 2) … 3) …, chacune sur 1 à 3 lignes, qui répondent à des questions.
▸ Indice optionnel : une référence de page ("p.67") apparaît parfois dans la zone.
Le cours, lui, est en prose continue (paragraphes, définitions) : recopie-le toujours, même entre deux zones d'exercices.

FORMAT : texte brut, sans balises \`\`\`, sans commentaire. Commence directement par le texte.`;

function listBlock(title, lines) {
  return lines.length ? `\n\n${title}\n${lines.join('\n')}` : '';
}

function vocabularyLines(vocabulary) {
  return (vocabulary ?? '').split(/[\n,;]/).map(w => w.trim()).filter(Boolean).slice(0, 300);
}

export function buildTranscriptionPrompt({ vocabulary, corrections = [], userNote } = {}) {
  const vocab = vocabularyLines(vocabulary);
  return TRANSCRIPTION_PROMPT
    + listBlock(
      "VOCABULAIRE DE CETTE MATIÈRE (pour déchiffrer les mots ambigus ; ne l'écris jamais s'il n'est pas sur la photo) :",
      vocab.length ? [vocab.join(', ')] : [])
    + listBlock(
      "ERREURS DE LECTURE DÉJÀ CORRIGÉES PAR L'UTILISATEUR (lu à tort → bon mot), ne les refais pas :",
      corrections.map(c => `- "${c.from}" → "${c.to}"`))
    + (userNote ? `\n\nINDICATION DE L'UTILISATEUR (ne t'en sers que si elle concerne la lecture) :\n${userNote}` : '');
}

// pages : tableau de pages, chaque page étant la liste de ses images (1 ou 2 bandes, cf. image.js).
// Renvoie un contenu de message au format OpenAI (blocs text / image_url).
export function buildTranscriptionContent(pages, { firstPage = 1, totalPages = pages.length } = {}) {
  const labels = [];
  const blocks = [];
  pages.forEach((images, i) => {
    const n = firstPage + i;
    for (const img of images) {
      const label = `Page ${n}${totalPages > 1 ? ` sur ${totalPages}` : ''}${img.part ? `, partie ${img.part}` : ''}`;
      labels.push(label);
      blocks.push({ type: 'text', text: `— ${label} —` });
      blocks.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } });
    }
  });

  const split = pages.some(images => images.length > 1);
  const instruction = [
    `Images, dans l'ordre : ${labels.join(' ; ')}.`,
    split ? "Une page découpée en partie haute et partie basse est UNE seule page : les deux parties se chevauchent, ne recopie qu'une fois les lignes visibles dans les deux." : null,
    totalPages > 1 ? 'Recopie les pages dans l\'ordre, séparées par une ligne vide.' : null,
    'Transcris intégralement le texte manuscrit, mot pour mot.',
  ].filter(Boolean).join('\n');

  return [...blocks, { type: 'text', text: instruction }];
}

export function cleanFences(text) {
  return text
    .replace(/^```(?:markdown|text)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

export function finishTranscription(raw) {
  const text = cleanFences(raw)
    .split('\n')
    .filter(line => line.trim().toLowerCase() !== EXERCISE_MARKER)
    .join('\n');
  return deduplicateOCR(text);
}

const STRUCTURE_SUFFIX = `

PRÉCISIONS SUR LE TEXTE REÇU :
- Il vient d'une transcription de notes manuscrites, éventuellement sur plusieurs pages : produis UN SEUL document unifié (une phrase ou un tableau peut continuer d'une page à l'autre)
- Les titres sont copiés MOT POUR MOT : n'ajoute jamais un niveau de titre absent (pas de ## C) si aucun C) n'est écrit) et n'enrichis jamais un titre
- Un paragraphe sans titre appartient à la partie en cours ; une nouvelle partie ne commence que là où son titre est écrit
- Un mot suivi de [?] est une lecture incertaine : corrige-le si le contexte rend le bon mot évident, sinon garde-le ; retire toujours le [?]
- Garde les [illisible] tels quels`;

export function buildStructureMessages(transcription, { systemPrompt = DEFAULT_SYSTEM_PROMPT, vocabulary, userNote } = {}) {
  const vocab = vocabularyLines(vocabulary);
  const system = systemPrompt
    + STRUCTURE_SUFFIX
    + listBlock("ORTHOGRAPHE DES TERMES DE CETTE MATIÈRE (pour corriger les mots mal lus, jamais pour ajouter du contenu) :",
      vocab.length ? [vocab.join(', ')] : [])
    + (userNote ? `\n\nINSTRUCTION SPÉCIALE :\n${userNote}` : '');
  return [
    { role: 'system', content: system },
    { role: 'user', content: DEFAULT_USER_TEMPLATE(transcription) },
  ];
}

export function structureMaxTokens(transcription) {
  const tokens = Math.ceil(transcription.length / 4);
  return Math.min(Math.max(Math.ceil(tokens * 1.4) + 200, 1024), 16384);
}

// Valide la structuration contre la transcription ; en cas d'échec (modèle indisponible,
// contenu inventé ou tronqué), la transcription est mise en forme par règles.
export function finalizeStructure(transcription, structured) {
  const cleaned = structured
    ? removeExerciseBlocks(cleanFences(structured).replace(/\n*<!--\s*METADATA[\s\S]*?-->\s*$/i, ''))
    : null;
  if (cleaned && isOutputValid(transcription, cleaned)) {
    return { rawStructured: cleaned, usedFallback: false };
  }
  log.debug('↩ Structuration rejetée ou indisponible → mise en forme par règles');
  return { rawStructured: applyRulesFormat(transcription), usedFallback: true };
}

export function deduplicateOCR(text) {
  const originalLen = text.length;

  const lines = text.split('\n');
  const step1 = [];
  let lastLine = null;
  for (const line of lines) {
    const t = line.trim();
    if (t !== lastLine) { step1.push(line); lastLine = t; }
  }

  let step2 = step1.join('\n');
  step2 = step2
    .replace(/([^.!?\n]{15,}[.!?])\s*(\1\s*){1,}/g, '$1')
    .replace(/(\b\w{4,}\b)(\s+\1){2,}/g, '$1');

  const lines2 = step2.split('\n');
  const WINDOW = 4;
  const step3 = [];
  let i = 0;
  while (i < lines2.length) {
    step3.push(lines2[i]);
    if (step3.length >= WINDOW) {
      const block = step3.slice(-WINDOW).map(l => l.trim()).join('\n');
      const ahead = lines2.slice(i + 1, i + 1 + WINDOW).map(l => l.trim()).join('\n');
      if (block === ahead && block.length > 20) {
        i += WINDOW;
        log.debug(`[OCR] bloc répété détecté (fenêtre ${WINDOW}) → sauté`);
        continue;
      }
    }
    i++;
  }

  const step4 = [];
  let k = 0;
  while (k < step3.length) {
    const cur = step3[k].trim();
    if (
      cur.length >= 30 &&
      k + 1 < step3.length &&
      !cur.startsWith('#') && !cur.startsWith('|') && !cur.startsWith('>')
    ) {
      const next = step3[k + 1].trim();
      if (next.startsWith(cur) && next.length >= cur.length + 6) {
        let j = k + 1;
        while (
          j + 1 < step3.length &&
          step3[j + 1].trim().startsWith(step3[j].trim()) &&
          step3[j + 1].trim().length >= step3[j].trim().length + 6
        ) {
          j++;
        }
        step4.push(step3[j]);
        log.debug(`[OCR] extension additive (${j - k + 1} lignes) → conservé la plus longue`);
        k = j + 1;
        continue;
      }
    }
    step4.push(step3[k]);
    k++;
  }

  const result = step4.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const removed = originalLen - result.length;
  if (removed > 50) {
    log.debug(`[OCR] déduplication : ${removed} chars supprimés (${originalLen} → ${result.length})`);
  }

  return result;
}
