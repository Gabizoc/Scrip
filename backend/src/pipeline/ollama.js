// backend/src/pipeline/ollama.js
//
// Pipeline Ollama — envoie les images directement à un modèle multimodal Ollama.
// Compatible avec tout modèle vision disponible sur Ollama (ex: gemini3-flash-preview).
// Utilise l'API OpenAI-compatible exposée par Ollama.
//
// Activé par PIPELINE_MODE=ollama dans le .env
// Configurable via OLLAMA_BASE_URL et OLLAMA_MODEL

import { DEFAULT_SYSTEM_PROMPT } from '../../prompts/default.js';
import { prepareImage, prepareImageSmall } from './ocr.js';
import { isOutputValid, applyRulesFormat, removeExerciseBlocks } from './format-rules.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL    = 'gemma4:31b-cloud';

const VISION_INSTRUCTION = `${DEFAULT_SYSTEM_PROMPT}

Tu regardes directement une photo de notes manuscrites françaises.
Lis EXACTEMENT le texte physiquement écrit dans l'image — n'ajoute rien de tes connaissances.

TABLEAUX :
- Compte d'abord le nombre exact de colonnes en regardant les séparateurs verticaux
- Le header doit avoir EXACTEMENT ce nombre de colonnes
- Si la 1ère colonne n'a pas de titre écrit → header vide : |  |
- Chaque ligne de données doit avoir le MÊME nombre de cellules que le header
- Si une cellule est vide → laisse vide entre les pipes : |  |

TEXTE MANUSCRIT :
- Si un mot est illisible → écris [illisible]
- Ne complète jamais avec tes connaissances

ZONES D'EXERCICES — IGNORER ABSOLUMENT :

Ce cahier contient deux types de contenu. Tu ne dois retranscrire QUE le cours.

▸ SIGNAL PRINCIPAL — deux traits horizontaux au stylo :
  Chaque zone d'exercice est encadrée par un trait horizontal avant et un après.
  Tout le contenu entre ces deux traits = ignorer entièrement.

▸ SIGNAL TEXTUEL — blocs numérotés courts :
  À l'intérieur des traits, le texte est organisé en réponses courtes numérotées : 1) … 2) … 3) …
  Ces réponses répondent à des questions (elles n'exposent pas un concept en prose continue).
  Ce pattern = toujours des exercices, jamais des sous-parties de cours.

▸ INDICE OPTIONNEL — référence de page :
  Parfois (pas toujours) une référence "p.67" ou "p.77" apparaît dans la zone.
  Quand elle est présente, c'est une confirmation supplémentaire que c'est un exercice.

▸ DISTINCTION COURS vs EXERCICE :
  Cours   → prose continue, paragraphes qui développent une idée, définitions approfondies
  Exercice → réponses courtes numérotées 1) 2) 3), chaque item tient en 1-3 lignes

COMPORTEMENT ATTENDU :
- Avant la zone d'exercice → transcrire le cours normalement
- Zone d'exercice (entre les deux traits, items numérotés courts) → ignorer complètement
- Après la zone d'exercice → reprendre le cours comme si la zone n'avait pas existé
- Ne mentionne JAMAIS les exercices dans ta sortie, ni les références de page

RAPPEL DU FORMAT ATTENDU (applique-le sur ce que tu lis) :
# Titre
# I - Grande partie        ← H1
## A) Sous-partie          ← H2
## B) Sous-partie          ← H2
# II - Grande partie       ← H1
# Conclusion               ← H1 si présente
# Définitions              ← H1, toujours en dernier si présentes
* **Terme :** Définition`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function cleanFences(text) {
  return text
    .replace(/^```(?:markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function buildMessages(images, count, systemInstruction = VISION_INSTRUCTION) {
  const imageBlocks = images.map(({ base64, mimeType }, i) => [
    // Annoter chaque image avec son numéro de page pour que le modèle sache l'ordre
    { type: 'text', text: count > 1 ? `— Page ${i + 1} sur ${count} —` : '' },
    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
  ]).flat().filter(b => b.text !== '');

  const instruction = count === 1
    ? 'Lis et formate en Markdown structuré le texte manuscrit de cette photo. Respecte le format du système.'
    : `Ces ${count} images sont les pages d'UN SEUL cours manuscrit, dans l'ordre.
Lis-les comme un document continu : une phrase peut commencer page ${1} et finir page ${2}, un tableau peut s'étaler sur plusieurs pages, une partie peut continuer d'une page à l'autre.
Produis UN SEUL document Markdown unifié — pas de séparateur entre les pages.
Respecte le format défini dans le système (# pour les grandes parties, ## pour les sous-parties, etc.).
N'invente rien : copie exactement ce qui est écrit.`;

  return [
    { role: 'system', content: systemInstruction },
    { role: 'user',   content: [...imageBlocks, { type: 'text', text: instruction }] },
  ];
}

// Utilise l'API native Ollama /api/chat (plus fiable que /v1/chat/completions
// pour les cloud models qui retournent Internal Server Error sur l'endpoint OpenAI).
async function callOllama(messages, model, baseUrl, maxTokens) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat`;

  const headers = { 'Content-Type': 'application/json' };
  const apiKey = process.env.OLLAMA_API_KEY;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  // Convertit le format OpenAI (image_url) → format natif Ollama (images: [base64])
  const ollamaMessages = messages.map(msg => {
    if (typeof msg.content === 'string') return { role: msg.role, content: msg.content };
    const texts  = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const images = msg.content
      .filter(b => b.type === 'image_url')
      .map(b => {
        // "data:image/jpeg;base64,<data>" → extraire juste la partie base64
        const url = b.image_url?.url ?? '';
        return url.includes(',') ? url.split(',')[1] : url;
      });
    return { role: msg.role, content: texts, ...(images.length ? { images } : {}) };
  });

  const body = JSON.stringify({
    model,
    options: { temperature: 0, num_predict: maxTokens },
    messages: ollamaMessages,
    stream: false,
  });

  process.stderr.write(`    [debug] POST ${endpoint} — model=${model} body=${body.length}B\n`);

  // Timeout explicite 90s (undici/Node.js fetch a un headers_timeout de 10s par défaut,
  // insuffisant pour les cloud models qui traitent des images).
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 90_000);

  let res;
  try {
    res = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal });
  } catch (err) {
    process.stderr.write(`    [debug] fetch ERREUR réseau: ${err.message}\n`);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  process.stderr.write(`    [debug] HTTP ${res.status} ${res.statusText}\n`);

  if (res.status === 429) {
    process.stderr.write(`    [debug] 429 rate-limit\n`);
    return null;
  }

  if (!res.ok) {
    const txt = await res.text();
    process.stderr.write(`    [debug] réponse erreur: ${txt.slice(0, 500)}\n`);
    if (res.status === 404) {
      process.stderr.write(`    ⚠ Ollama modèle "${model}" introuvable — vérifie que le modèle est installé (ollama pull ${model})\n`);
      return null;
    }
    throw new Error(`Ollama erreur ${res.status}: ${txt}`);
  }

  let txt;
  try {
    txt = await res.text();
    process.stderr.write(`    [debug] réponse reçue: ${txt.length}B\n`);
  } catch (err) {
    process.stderr.write(`    [debug] erreur lecture body: ${err.message}\n`);
    throw err;
  }

  let data;
  try {
    data = JSON.parse(txt);
  } catch (err) {
    process.stderr.write(`    [debug] JSON invalide: ${txt.slice(0, 300)}\n`);
    throw new Error(`Ollama: réponse JSON invalide: ${err.message}`);
  }

  // Format natif Ollama /api/chat : { message: { content: "..." } }
  const content = data.message?.content ?? null;
  if (!content) {
    process.stderr.write(`    [debug] content null — data keys: ${Object.keys(data).join(', ')}\n`);
    if (data.error) process.stderr.write(`    [debug] data.error: ${JSON.stringify(data.error)}\n`);
  }
  return content;
}

/**
/**
 * Détecte une boucle de répétition dans un texte (hallucination LLM classique).
 * Prélève des échantillons de 50 chars toutes les 80 chars et cherche un doublon.
 */
function hasRepetitionLoop(text) {
  if (text.length < 400) return false;
  const seen = new Set();
  for (let i = 0; i < text.length - 50; i += 80) {
    const sample = text.slice(i, i + 50);
    if (seen.has(sample)) return true;
    seen.add(sample);
  }
  return false;
}

/**
 * Appel Ollama léger pour validation croisée : lit le texte brut des images
 * sans mise en forme ni filtrage. Utilisé comme référence par d'autres pipelines.
 * Retourne null en cas d'erreur, d'indisponibilité ou de boucle de répétition.
 */
export async function callOllamaRaw(imagePaths) {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
  const model   = process.env.OLLAMA_MODEL    ?? DEFAULT_MODEL;

  // Utilise des images réduites (800px q55) pour éviter les timeouts sur cloud models
  const images = await Promise.all(imagePaths.map(prepareImageSmall));

  const messages = [
    {
      role: 'system',
      content: 'Tu lis le texte manuscrit des images et tu le retranscris tel quel, sans mise en forme. Copie uniquement ce qui est écrit.',
    },
    {
      role: 'user',
      content: [
        ...images.map(({ base64, mimeType }, i) => [
          { type: 'text', text: images.length > 1 ? `Page ${i + 1} :` : '' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ]).flat().filter(b => b.text !== ''),
        { type: 'text', text: 'Transcris le texte manuscrit de ces images, mot pour mot.' },
      ],
    },
  ];

  process.stderr.write(`    → Ollama validation (${model})\n`);
  try {
    const raw = await callOllama(messages, model, baseUrl, 4096);
    if (!raw) return null;
    const cleaned = cleanFences(raw);
    if (hasRepetitionLoop(cleaned)) {
      process.stderr.write(`    ⚠ Ollama validation : boucle de répétition détectée → rejet\n`);
      return null;
    }
    process.stderr.write(`    ✓ Ollama validation → ${cleaned.length} chars\n`);
    return cleaned;
  } catch (err) {
    process.stderr.write(`    ⚠ Ollama validation échoué: ${err.message}\n`);
    return null;
  }
}

/**
 * Pipeline Ollama : image(s) → Markdown structuré.
 *
 * Lit OLLAMA_BASE_URL (défaut: http://localhost:11434)
 * Lit OLLAMA_MODEL    (défaut: gemini3-flash-preview)
 */
export async function runOllamaPipeline(imagePaths, userNote = null) {
  const paths   = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
  const model   = process.env.OLLAMA_MODEL    ?? DEFAULT_MODEL;

  process.stderr.write(`[ollama] ${paths.length} image(s), modèle: ${model}, endpoint: ${baseUrl}\n`);

  const images    = await Promise.all(paths.map(prepareImage));
  const maxTokens = Math.min(4096 * paths.length, 16384);

  // Instruction finale : prompt de base + note utilisateur facultative
  const systemInstruction = userNote
    ? `${VISION_INSTRUCTION}\n\nINSTRUCTION SPÉCIALE :\n${userNote}`
    : VISION_INSTRUCTION;
  if (userNote) process.stderr.write(`    [userNote] "${userNote}"\n`);

  const messages  = buildMessages(images, paths.length, systemInstruction);

  process.stderr.write(`    → ${model}\n`);
  const raw = await callOllama(messages, model, baseUrl, maxTokens);

  if (!raw) {
    throw new Error(`Ollama: le modèle "${model}" est inaccessible sur ${baseUrl}. Vérifie qu'Ollama tourne et que le modèle est installé.`);
  }

  process.stderr.write(`    ✓ Ollama ${model} → ${raw.length} chars\n`);

  const cleaned = cleanFences(raw);
  const filtered = removeExerciseBlocks(cleaned);
  return { rawMarkdown: filtered, imageRegions: [], modelUsed: model };
}
