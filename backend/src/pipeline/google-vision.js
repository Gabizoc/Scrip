import { DEFAULT_SYSTEM_PROMPT } from '../../prompts/default.js';
import { prepareImage } from './ocr.js';
import { isOutputValid, removeExerciseBlocks } from './format-rules.js';
import { callOllamaRaw } from './ollama.js';

const GOOGLE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const GEMINI_PRIMARY_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b'];

const VISION_INSTRUCTION = `${DEFAULT_SYSTEM_PROMPT}

Tu regardes directement une photo de notes manuscrites françaises.
Lis EXACTEMENT le texte physiquement écrit dans l'image — n'ajoute rien de tes connaissances.

TITRES ET SOUS-TITRES — RÈGLE ABSOLUE :
- Copie les titres MOT POUR MOT, exactement comme écrits, y compris les points d'interrogation
- N'ajoute JAMAIS un niveau de titre qui n'est pas écrit dans les notes (ex: pas de ## C) si aucun C) n'est visible)
- N'enrichis JAMAIS un titre avec des mots absents du titre original (ex: si le titre écrit est "B) L'empire byzantin, une civilisation sur le déclin?" ne le transforme pas en "B) L'Empire byzantin (Basileus)")

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

ZONES D'EXERCICES — IGNORER ABSOLUMENT :

Ce cahier contient deux types de contenu. Tu ne dois retranscrire QUE le cours.

▸ SIGNAL PRINCIPAL — deux traits horizontaux au stylo :
  Chaque zone d'exercice est encadrée par un trait avant et un après.
  Tout le contenu entre ces deux traits = ignorer entièrement.

▸ SIGNAL TEXTUEL — blocs numérotés courts :
  Des réponses courtes numérotées 1) … 2) … 3) … qui répondent à des questions
  (pas de prose continue exposant un concept) = exercices à ignorer.

▸ INDICE OPTIONNEL — référence de page :
  Parfois (pas toujours) une référence "p.67" ou "p.77" apparaît dans la zone.
  Quand présente, c'est une confirmation supplémentaire.

▸ DISTINCTION COURS vs EXERCICE :
  Cours   → prose continue, paragraphes développant une idée, définitions approfondies
  Exercice → réponses courtes numérotées 1) 2) 3), chaque item tient en 1-3 lignes

→ Avant la zone : cours normal. Après la zone : reprendre le cours comme si elle n'existait pas.
→ Ne mentionne JAMAIS les exercices ni les références de page dans ta sortie.

CONTENU ORPHELIN APRÈS UNE ZONE D'EXERCICES :
Quand du texte de cours reprend après la fin d'une zone d'exercices (après le second trait horizontal), ce texte appartient à la SECTION EN COURS (grande partie ou sous-partie), pas à la section suivante.
- Si aucun titre de sous-partie n'est écrit (pas de ## C)), place le texte en corps de la partie courante, sans inventer de titre.
- La prochaine grande partie (# II, # III…) ne commence que là où son titre est physiquement écrit dans les notes — pas avant.
Exemple : [fin zone exercice] → paragraphe sur le monde musulman → [# II - ...]
  → Le paragraphe sur le monde musulman appartient à # I, même sans ## C) écrit.

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

async function callGemini(images, apiKey, model, instruction, count, { maxRetries = 2 } = {}) {
  const url = `${GOOGLE_ENDPOINT}/${model}:generateContent?key=${apiKey}`;

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
      maxOutputTokens: Math.min(8192 * count, 65536),
      thinkingConfig: { thinkingBudget: 0 },
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
      let retryAfterMs = null;

      const retryHeader = res.headers.get('Retry-After') ?? res.headers.get('retry-after');
      if (retryHeader) {
        const asSeconds = parseInt(retryHeader, 10);
        retryAfterMs = isNaN(asSeconds)
          ? Math.max(0, new Date(retryHeader).getTime() - Date.now())
          : asSeconds * 1000;
      }

      if (!retryAfterMs) {
        try {
          const errBody = await res.clone().json();
          const details = errBody?.error?.details ?? [];
          for (const d of details) {
            if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
              const match = String(d.retryDelay).match(/([\d.]+)s/);
              if (match) { retryAfterMs = parseFloat(match[1]) * 1000; break; }
            }
          }
        } catch { /* */ }
      }

      const fallbackMs = (attempt + 1) * 8000;
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
        return null;
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
    }

    return candidate.content?.parts?.[0]?.text ?? null;
  }

  return null;
}

export async function runGoogleVisionPipeline(imagePaths, subject, level, googleKey, mistralKey, nvidiaKey, openrouterKey, userNote = null, systemPrompt = null) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  process.stderr.write(`[google] ${paths.length} image(s), mode Gemini vision\n`);

  const images = await Promise.all(paths.map(prepareImage));

  const baseInstruction = systemPrompt ?? VISION_INSTRUCTION;
  const instruction = userNote
    ? `${baseInstruction}\n\nINSTRUCTION SPÉCIALE :\n${userNote}`
    : baseInstruction;
  if (userNote) process.stderr.write(`    [userNote] "${userNote}"\n`);

  const ollamaEnabled = (process.env.OLLAMA_VALIDATION ?? 'true') !== 'false';
  const litePromise = ollamaEnabled
    ? callOllamaRaw(paths).catch(() => null)
    : Promise.resolve(null);

  let geminiOutput = null;
  let modelUsed = null;

  for (const model of GEMINI_PRIMARY_MODELS) {
    process.stderr.write(`    → Gemini ${model}\n`);
    geminiOutput = await callGemini(images, googleKey, model, instruction, paths.length, { maxRetries: 2 });
    if (geminiOutput !== null) {
      modelUsed = model;
      process.stderr.write(`    ✓ Gemini ${model} → ${geminiOutput.length} chars\n`);
      break;
    }
    await sleep(2000);
  }

  const liteReference = await litePromise;

  if (geminiOutput) {
    const geminiCleaned = removeExerciseBlocks(cleanFences(geminiOutput));

    if (liteReference) {
      const reference = liteReference;
      const refSource = `Ollama (${process.env.OLLAMA_MODEL ?? 'gemma4:31b-cloud'})`;
      const valid = isOutputValid(reference, geminiCleaned);

      process.stderr.write(`    [validation/${refSource}] seuil=55% — ref: ${reference.length}c, Gemini: ${geminiCleaned.length}c\n`);

      if (valid) {
        process.stderr.write(`    ✓ Gemini validé par ${refSource}\n`);
        return { rawMarkdown: geminiCleaned, imageRegions: [], modelUsed };
      }

      const geminiHasStructure = /^#\s+/m.test(geminiCleaned) && geminiCleaned.length > 300;
      const fallbackContent = geminiHasStructure ? geminiCleaned : reference;
      const fallbackReason = geminiHasStructure
        ? 'sortie tronquée mais structurée'
        : 'fallback OCR formaté';
      process.stderr.write(`    ↩ Gemini rejeté par ${refSource} → ${fallbackReason}\n`);
      return { rawMarkdown: fallbackContent, imageRegions: [], usedFallback: true };
    }

    process.stderr.write(`    ⚠ Aucune référence disponible — Gemini retourné sans validation\n`);
    return { rawMarkdown: geminiCleaned, imageRegions: [], modelUsed };
  }

  throw new Error('Tous les providers sont indisponibles (Gemini + NVIDIA + OpenRouter).');
}
