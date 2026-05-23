// backend/src/pipeline/vision.js
//
// Pipeline VISION — mode alternatif à OCR + structuration.
// Envoie les images directement à un LLM multimodal avec le prompt de structuration.
// Une seule étape LLM principale, mais on fait aussi un OCR léger pour valider
// que la sortie colle au contenu réel de l'image.

import { SHS_SYSTEM_PROMPT } from '../../prompts/shs.js';
import { prepareImage, runOCR } from './ocr.js';
import { isOutputValid, applyRulesFormat } from './format-rules.js';

const NVIDIA_ENDPOINT     = 'https://integrate.api.nvidia.com/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Modèles vision NVIDIA NIM (multimodaux)
// llama-4-maverick retiré : hallucine massivement sur le texte manuscrit français
const NVIDIA_VISION_MODELS = [
  'nvidia/llama-3.2-90b-vision-instruct',
];

// Modèles vision OpenRouter gratuits (multimodaux)
const OPENROUTER_VISION_MODELS = [
  'qwen/qwen2.5-vl-72b-instruct:free',  // meilleur pour OCR / texte manuscrit
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-4-maverick:free',
  'openrouter/auto',
];

// Prompt système : combine lecture + mise en forme en une instruction
const VISION_SYSTEM_PROMPT = `${SHS_SYSTEM_PROMPT}

Tu regardes directement une photo de notes manuscrites françaises.
Lis EXACTEMENT le texte physiquement écrit dans l'image — n'ajoute rien de tes connaissances.

TABLEAUX — règles strictes :
1. Compte le nombre EXACT de colonnes visibles dans le tableau (compte les séparateurs verticaux)
2. Reproduis TOUTES les colonnes, même si certaines cellules sont vides
3. La ligne d'en-tête doit avoir le même nombre de colonnes que les lignes de données
4. N'invente pas de contenu pour les cellules illisibles — écris [illisible]
5. Si la 1ère colonne n'a pas de titre écrit → header vide : |  |
6. Chaque ligne de données doit avoir le MÊME nombre de cellules que le header

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

function buildUserContent(images, count) {
  const imageBlocks = images.map(({ base64, mimeType }) => ({
    type: 'image_url',
    image_url: { url: `data:${mimeType};base64,${base64}` },
  }));

  const instruction = count === 1
    ? 'Lis et formate en Markdown structuré le texte manuscrit de cette photo. Respecte le format défini dans le système.'
    : `Ces ${count} images sont les pages d'UN SEUL cours manuscrit, dans l'ordre.
Lis-les comme un document continu : une phrase peut commencer page 1 et finir page 2, un tableau peut s'étaler sur plusieurs pages, une partie peut continuer d'une page à l'autre.
Produis UN SEUL document Markdown unifié — pas de séparateur entre les pages.
Respecte le format défini dans le système (# pour les grandes parties, ## pour les sous-parties, etc.).
N'invente rien : copie exactement ce qui est écrit.`;

  // Annoter chaque image avec son numéro de page pour que le modèle sache l'ordre
  const annotatedContent = count === 1
    ? [...imageBlocks, { type: 'text', text: instruction }]
    : images.flatMap(({ base64, mimeType }, i) => [
        { type: 'text', text: `— Page ${i + 1} sur ${count} —` },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ]).concat([{ type: 'text', text: instruction }]);

  return annotatedContent;
}

function cleanFences(text) {
  return text
    .replace(/^```(?:markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

async function callNvidiaVision(messages, apiKey, model, maxTokens) {
  const res = await fetch(NVIDIA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }),
  });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      process.stderr.write(`    ⚠ NVIDIA vision ${model} indisponible (${res.status})\n`);
      return null;
    }
    throw new Error(`NVIDIA vision erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

async function callOpenRouterVision(messages, apiKey, model, maxTokens) {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://scrip.local',
      'X-Title': 'Scrip',
    },
    body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }),
  });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      process.stderr.write(`    ⚠ OpenRouter vision ${model} indisponible (${res.status})\n`);
      return null;
    }
    throw new Error(`OpenRouter vision erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

/**
 * Pipeline vision : image(s) → Markdown structuré en une seule étape LLM.
 *
 * Stratégie :
 *  1. Appel OCR léger (pixtral) en parallèle de l'appel vision → référence textuelle
 *  2. LLM vision (NVIDIA → OpenRouter) → sortie candidate
 *  3. Validation de la sortie contre le texte OCR
 *  4. Si invalide → fallback formateur basé sur des règles appliqué à l'OCR
 */
export async function runVisionPipeline(imagePaths, subject, level, nvidiaKey, openrouterKey, mistralKey) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  process.stderr.write(`[vision] ${paths.length} image(s), mode vision direct\n`);

  // Préparer les images (resize + base64) — utilisé par les deux branches
  const images = await Promise.all(paths.map(prepareImage));
  const maxTokens = Math.min(4096 * paths.length, 16384);

  const visionMessages = [
    { role: 'system', content: VISION_SYSTEM_PROMPT },
    { role: 'user',   content: buildUserContent(images, paths.length) },
  ];

  // ── Lancer OCR (référence) ET vision LLM en parallèle ──────────────────────
  const ocrPromise = mistralKey
    ? runOCR(paths, mistralKey).then(r => r.rawMarkdown).catch(err => {
        process.stderr.write(`    ⚠ OCR parallèle échoué (${err.message}), validation désactivée\n`);
        return null;
      })
    : Promise.resolve(null);

  // Vision LLM — NVIDIA puis OpenRouter
  let visionOutput = null;

  if (nvidiaKey) {
    for (const model of NVIDIA_VISION_MODELS) {
      process.stderr.write(`    → NVIDIA vision ${model}\n`);
      visionOutput = await callNvidiaVision(visionMessages, nvidiaKey, model, maxTokens);
      if (visionOutput !== null) {
        process.stderr.write(`    ✓ NVIDIA vision → ${visionOutput.length} chars\n`);
        break;
      }
      await sleep(1000);
    }
  }

  if (!visionOutput && openrouterKey) {
    for (const model of OPENROUTER_VISION_MODELS) {
      process.stderr.write(`    → OpenRouter vision ${model}\n`);
      visionOutput = await callOpenRouterVision(visionMessages, openrouterKey, model, maxTokens);
      if (visionOutput !== null) {
        process.stderr.write(`    ✓ OpenRouter vision → ${visionOutput.length} chars\n`);
        break;
      }
      await sleep(800);
    }
  }

  if (!visionOutput) {
    throw new Error('Aucun modèle vision disponible. Passe en mode PIPELINE_MODE=ocr et réessaie.');
  }

  const visionCleaned = cleanFences(visionOutput);

  // ── Attendre l'OCR de référence et valider ─────────────────────────────────
  const ocrReference = await ocrPromise;

  if (ocrReference) {
    process.stderr.write(`    [validation] OCR référence: ${ocrReference.length} chars\n`);
    if (isOutputValid(ocrReference, visionCleaned)) {
      return { rawMarkdown: visionCleaned, rawVisionOutput: visionCleaned, imageRegions: [], reliable: true };
    }
    process.stderr.write(`    ↩ Vision rejetée, fallback OCR + formateur règles\n`);
    const fallback = applyRulesFormat(ocrReference);
    // rawVisionOutput = sortie brute du modèle (avant fallback), utile pour cross-validation externe
    return { rawMarkdown: fallback, rawVisionOutput: visionCleaned, imageRegions: [], usedFallback: true, reliable: false };
  }

  process.stderr.write(`    ⚠ Validation désactivée (pas de clé Mistral ou OCR échoué)\n`);
  return { rawMarkdown: visionCleaned, rawVisionOutput: visionCleaned, imageRegions: [], reliable: false };
}
