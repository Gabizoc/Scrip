// backend/src/pipeline/ollama.js
//
// Pipeline Ollama — envoie les images directement à un modèle multimodal Ollama.
// Compatible avec tout modèle vision disponible sur Ollama (ex: gemini3-flash-preview).
// Utilise l'API OpenAI-compatible exposée par Ollama.
//
// Activé par PIPELINE_MODE=ollama dans le .env
// Configurable via OLLAMA_BASE_URL et OLLAMA_MODEL

import { SHS_SYSTEM_PROMPT } from '../../prompts/shs.js';
import { prepareImage } from './ocr.js';
import { isOutputValid, applyRulesFormat } from './format-rules.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL    = 'gemma4:31b-cloud';

const VISION_INSTRUCTION = `${SHS_SYSTEM_PROMPT}

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

ZONES À IGNORER ABSOLUMENT :
Ces cahiers contiennent deux types de contenu mélangés (tous deux peuvent être écrits au bic bleu) :
1. LE COURS (à retranscrire) — paragraphes continus, titres, définitions, explications
2. LES EXERCICES (à ignorer totalement) — zones délimitées par deux lignes horizontales tracées au stylo noir (comme des séparateurs de section), contenant des réponses numérotées 1) 2) 3) 4) etc.

Indices visuels pour identifier une zone d'exercices à ignorer :
- Deux lignes horizontales encadrent la zone (avant et après)
- Le texte est organisé en blocs numérotés 1) 2) 3)…
- Chaque bloc répond à une question courte (plutôt qu'exposer un concept)
- Il peut aussi y avoir une référence de page (ex: "p.67", "p.75") dans la zone

→ Toute zone entre deux lignes horizontales = ignorer entièrement.
→ Ne mentionne PAS ces zones dans ta sortie, fais comme si elles n'existaient pas.

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

function buildMessages(images, count) {
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
    { role: 'system', content: VISION_INSTRUCTION },
    { role: 'user',   content: [...imageBlocks, { type: 'text', text: instruction }] },
  ];
}

async function callOllama(messages, model, baseUrl, maxTokens) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  const apiKey = process.env.OLLAMA_API_KEY;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = JSON.stringify({
    model,
    temperature: 0,
    max_tokens:  maxTokens,
    messages,
    stream: false,
  });

  process.stderr.write(`    [debug] POST ${endpoint} — model=${model} max_tokens=${maxTokens} body=${body.length}B\n`);

  let res;
  try {
    res = await fetch(endpoint, { method: 'POST', headers, body });
  } catch (err) {
    process.stderr.write(`    [debug] fetch ERREUR réseau: ${err.message}\n`);
    throw err;
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

  const content = data.choices?.[0]?.message?.content ?? null;
  if (!content) {
    process.stderr.write(`    [debug] content null — data keys: ${Object.keys(data).join(', ')}\n`);
    if (data.error) process.stderr.write(`    [debug] data.error: ${JSON.stringify(data.error)}\n`);
  }
  return content;
}

/**
 * Pipeline Ollama : image(s) → Markdown structuré.
 *
 * Lit OLLAMA_BASE_URL (défaut: http://localhost:11434)
 * Lit OLLAMA_MODEL    (défaut: gemini3-flash-preview)
 */
export async function runOllamaPipeline(imagePaths) {
  const paths   = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL;
  const model   = process.env.OLLAMA_MODEL    ?? DEFAULT_MODEL;

  process.stderr.write(`[ollama] ${paths.length} image(s), modèle: ${model}, endpoint: ${baseUrl}\n`);

  const images    = await Promise.all(paths.map(prepareImage));
  const maxTokens = Math.min(4096 * paths.length, 16384);
  const messages  = buildMessages(images, paths.length);

  process.stderr.write(`    → ${model}\n`);
  const raw = await callOllama(messages, model, baseUrl, maxTokens);

  if (!raw) {
    throw new Error(`Ollama: le modèle "${model}" est inaccessible sur ${baseUrl}. Vérifie qu'Ollama tourne et que le modèle est installé.`);
  }

  process.stderr.write(`    ✓ Ollama ${model} → ${raw.length} chars\n`);

  const cleaned = cleanFences(raw);
  return { rawMarkdown: cleaned, imageRegions: [], modelUsed: model };
}
