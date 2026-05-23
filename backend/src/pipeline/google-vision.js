// backend/src/pipeline/google-vision.js
//
// Pipeline Google Gemini — lit les images directement via l'API Google AI Studio.
// Gemini est particulièrement bon sur les tableaux manuscrits et le français.
//
// Activé par PIPELINE_MODE=google dans le .env

import { SHS_SYSTEM_PROMPT } from '../../prompts/shs.js';
import { prepareImage } from './ocr.js';
import { isOutputValid, applyRulesFormat } from './format-rules.js';
import { runVisionPipeline } from './vision.js';

const GOOGLE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Modèle principal : meilleure qualité
const GEMINI_PRIMARY_MODELS = [
  'gemini-2.5-flash',          // meilleur sur les images (stable depuis juin 2025)
  'gemini-2.0-flash',          // rapide, très bon sur les tableaux
  'gemini-1.5-flash-latest',   // fallback stable
  'gemini-1.5-flash-8b',       // dernier recours, très léger
];

// Modèle de validation : léger, lancé en parallèle pour cross-vérifier
const GEMINI_VALIDATION_MODEL = 'gemini-2.0-flash-lite';

const VISION_INSTRUCTION = `${SHS_SYSTEM_PROMPT}

Tu regardes directement une photo de notes manuscrites françaises.
Lis EXACTEMENT le texte physiquement écrit dans l'image — n'ajoute rien de tes connaissances.

TABLEAUX :
- Compte d'abord le nombre exact de colonnes en regardant les séparateurs verticaux
- Le header doit avoir EXACTEMENT ce nombre de colonnes
- Si la 1ère colonne n'a pas de titre écrit (colonne de libellés de lignes) → header vide : |  |
- Exemple : tableau à 4 colonnes dont la 1ère sans titre →
  |  | Localisation | Potentialités | Aléas/risques |
  |---|---|---|---|
  | Milieu montagnard | Pyrénées, Alpes | barrages, tourisme | avalanche |
- Chaque ligne de données doit avoir le MÊME nombre de cellules que le header
- Chaque cellule = uniquement ce qui est écrit dedans, rien d'inventé
- Si une cellule est vide → laisse vide entre les pipes : |  |

TEXTE MANUSCRIT :
- Si un mot est illisible → écris [illisible]
- Ne complète jamais avec tes connaissances (ex: ne liste pas les régions françaises si elles ne sont pas écrites)

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

/**
 * Appelle l'API Gemini avec retry sur 429.
 * @param {number} maxRetries - Nombre de tentatives supplémentaires après le 1er 429
 */
async function callGemini(images, apiKey, model, instruction, count, { maxRetries = 2 } = {}) {
  const url = `${GOOGLE_ENDPOINT}/${model}:generateContent?key=${apiKey}`;

  // Annoter chaque image avec son numéro de page pour que le modèle sache l'ordre
  const imageParts = count === 1
    ? images.map(({ base64, mimeType }) => ({
        inline_data: { mime_type: mimeType, data: base64 },
      }))
    : images.flatMap(({ base64, mimeType }, i) => [
        { text: `— Page ${i + 1} sur ${count} —` },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ]);

  const instructionText = count === 1
    ? 'Lis et formate en Markdown structuré le texte manuscrit de cette photo. Respecte le format défini dans le système.'
    : `Ces ${count} images sont les pages d'UN SEUL cours manuscrit, dans l'ordre.
Lis-les comme un document continu : une phrase peut commencer page 1 et finir page 2, un tableau peut s'étaler sur plusieurs pages, une partie peut continuer d'une page à l'autre.
Produis UN SEUL document Markdown unifié — pas de séparateur entre les pages.
Respecte le format défini dans le système (# pour les grandes parties, ## pour les sous-parties, etc.).
N'invente rien : copie exactement ce qui est écrit.`;

  const parts = [...imageParts, { text: instructionText }];

  const body = {
    system_instruction: { parts: [{ text: instruction }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: Math.min(8192 * count, 32768),
    },
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      process.stderr.write(`    ↻ Gemini ${model} tentative ${attempt + 1}/${maxRetries + 1}\n`);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      // Lire le délai suggéré par Google (header Retry-After ou body JSON)
      let retryAfterMs = null;

      const retryHeader = res.headers.get('Retry-After') ?? res.headers.get('retry-after');
      if (retryHeader) {
        // Valeur en secondes (entier) ou date HTTP
        const asSeconds = parseInt(retryHeader, 10);
        retryAfterMs = isNaN(asSeconds)
          ? Math.max(0, new Date(retryHeader).getTime() - Date.now())
          : asSeconds * 1000;
      }

      if (!retryAfterMs) {
        // Chercher dans le body JSON : error.details[].retryDelay ou metadata.retryDelay
        try {
          const body = await res.clone().json();
          const details = body?.error?.details ?? [];
          for (const d of details) {
            if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
              // Format Google : "8s" ou "8.000s"
              const match = String(d.retryDelay).match(/([\d.]+)s/);
              if (match) { retryAfterMs = parseFloat(match[1]) * 1000; break; }
            }
          }
        } catch { /* body non JSON, ignoré */ }
      }

      const fallbackMs = (attempt + 1) * 8000; // 8s, 16s, 24s
      const waitMs = retryAfterMs ? Math.min(retryAfterMs + 500, 60_000) : fallbackMs;

      process.stderr.write(
        `    ⚠ Gemini ${model} rate limit (429)` +
        (attempt < maxRetries
          ? ` — retry dans ${(waitMs / 1000).toFixed(1)}s${retryAfterMs ? ' (Retry-After Google)' : ' (backoff)'}\n`
          : '\n')
      );

      if (attempt < maxRetries) await sleep(waitMs);
      continue;
    }
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 404 || res.status === 400) {
        process.stderr.write(`    ⚠ Gemini ${model} indisponible (${res.status})\n`);
        return null; // pas la peine de retry sur 404
      }
      throw new Error(`Gemini erreur ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      process.stderr.write(`    ⚠ Gemini ${model} : aucun candidat retourné\n`);
      return null;
    }
    if (candidate.finishReason === 'SAFETY') {
      process.stderr.write(`    ⚠ Gemini ${model} : bloqué par filtre de sécurité\n`);
      return null;
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      process.stderr.write(`    ⚠ Gemini ${model} : limite de tokens atteinte (sortie tronquée)\n`);
      // On retourne quand même le texte partiel — mieux que rien
    }

    return candidate.content?.parts?.[0]?.text ?? null;
  }

  return null; // tous les retries épuisés
}

/**
 * Pipeline Google Gemini avec fallback NVIDIA / OpenRouter.
 *
 * Stratégie (tout en parallèle) :
 *  1. Gemini principal  (gemini-2.5-flash → gemini-2.0-flash → …)
 *  2. Gemini lite       (validation croisée, avec retry 429)
 *  3. NVIDIA/OpenRouter (fallback principal ET validation de secours)
 *
 * Priorité du résultat :
 *  - Gemini principal validé par lite → retourné
 *  - Gemini principal validé par NVIDIA/OR → retourné
 *  - NVIDIA/OR seul (si Gemini complètement indisponible)
 *  - Fallback règles sur la meilleure référence disponible
 */
export async function runGoogleVisionPipeline(imagePaths, subject, level, googleKey, mistralKey, nvidiaKey, openrouterKey) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  process.stderr.write(`[google] ${paths.length} image(s), mode Gemini vision\n`);

  const images = await Promise.all(paths.map(prepareImage));

  // ── 1. Gemini lite — validation croisée (retry 429) ─────────────────────────
  const litePromise = sleep(1500).then(() => {
    process.stderr.write(`    → Gemini ${GEMINI_VALIDATION_MODEL} (validation)\n`);
    return callGemini(images, googleKey, GEMINI_VALIDATION_MODEL, VISION_INSTRUCTION, paths.length, { maxRetries: 3 });
  })
    .then(r => r ? cleanFences(r) : null)
    .catch(() => null);

  // ── 2. NVIDIA / OpenRouter — fallback et validation de secours ───────────────
  const visionFallbackPromise = (nvidiaKey || openrouterKey)
    ? runVisionPipeline(paths, subject, level, nvidiaKey, openrouterKey, mistralKey)
        .then(r => {
          process.stderr.write(`    ✓ Fallback vision → ${r.rawMarkdown.length} chars (reliable: ${r.reliable})\n`);
          return r; // on garde l'objet complet pour accéder à rawVisionOutput et reliable
        })
        .catch(err => { process.stderr.write(`    ⚠ Fallback vision échoué: ${err.message}\n`); return null; })
    : Promise.resolve(null);

  // ── 3. Gemini principal ──────────────────────────────────────────────────────
  let geminiOutput = null;
  let modelUsed = null;

  for (const model of GEMINI_PRIMARY_MODELS) {
    process.stderr.write(`    → Gemini ${model}\n`);
    geminiOutput = await callGemini(images, googleKey, model, VISION_INSTRUCTION, paths.length, { maxRetries: 2 });
    if (geminiOutput !== null) {
      modelUsed = model;
      process.stderr.write(`    ✓ Gemini ${model} → ${geminiOutput.length} chars\n`);
      break;
    }
    await sleep(2000);
  }

  // ── Résolution des résultats parallèles ─────────────────────────────────────
  const [liteReference, visionResult] = await Promise.all([litePromise, visionFallbackPromise]);

  // Gemini principal disponible → tenter validation
  if (geminiOutput) {
    const geminiCleaned = cleanFences(geminiOutput);

    // Choisir la meilleure référence disponible :
    // 1. Gemini lite (même moteur, plus fiable comme cross-check)
    // 2. rawVisionOutput de NVIDIA/OR si fiable (lecture directe de l'image)
    // 3. rawVisionOutput même non fiable (lecture brute, seuil réduit)
    // 4. rawMarkdown fallback (OCR-based, dernier recours)
    let reference = null;
    let refSource = null;
    let strict = true; // seuil 55% si même moteur, 35% sinon

    if (liteReference) {
      reference = liteReference;
      refSource = 'Gemini lite';
      strict = true;
    } else if (visionResult?.reliable) {
      // N'utiliser NVIDIA/OR comme référence QUE s'il a passé sa propre validation OCR
      reference = visionResult.rawVisionOutput;
      refSource = 'NVIDIA/OR (validé)';
      strict = false; // inter-modèles → seuil souple
    }
    // Si NVIDIA/OR n'est pas fiable → on ne l'utilise pas comme veto sur Gemini

    if (reference) {
      const valid = strict
        ? isOutputValid(reference, geminiCleaned)
        : isOutputValid(reference, geminiCleaned, { minOverlap: 0.35, minRatio: 0.2, maxRatio: 1.6 });

      process.stderr.write(`    [validation/${refSource}] seuil=${strict ? '55' : '35'}% — ref: ${reference.length}c, Gemini: ${geminiCleaned.length}c\n`);

      if (valid) {
        process.stderr.write(`    ✓ Gemini validé par ${refSource}\n`);
        return { rawMarkdown: geminiCleaned, imageRegions: [], modelUsed };
      }

      // Gemini rejeté — fallback sur l'OCR via vision pipeline (rawMarkdown = OCR formaté)
      const fallbackContent = visionResult?.rawMarkdown ?? reference;
      process.stderr.write(`    ↩ Gemini rejeté par ${refSource} → fallback OCR formaté\n`);
      return { rawMarkdown: fallbackContent, imageRegions: [], usedFallback: true };
    }

    // Aucune référence → retourner Gemini sans validation
    process.stderr.write(`    ⚠ Aucune référence disponible — Gemini retourné sans validation\n`);
    return { rawMarkdown: geminiCleaned, imageRegions: [], modelUsed };
  }

  // Gemini complètement indisponible → utiliser NVIDIA/OR
  if (visionResult) {
    process.stderr.write(`    ↩ Gemini indisponible — fallback NVIDIA/OR\n`);
    return { rawMarkdown: visionResult.rawMarkdown, imageRegions: [], usedFallback: true };
  }

  throw new Error('Tous les providers sont indisponibles (Gemini + NVIDIA + OpenRouter).');
}
