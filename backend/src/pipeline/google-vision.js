import { log } from '../lib/logger.js';
import { llmSignal } from './http.js';
import { preparePages } from './image.js';
import { isOutputValid } from './format-rules.js';
import { buildTranscriptionPrompt, buildTranscriptionContent, finishTranscription, cleanFences, hasRepetitionLoop } from './transcribe.js';
import { callOllamaRaw, getOllamaConfig } from './ollama.js';

const GOOGLE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const GEMINI_PRIMARY_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b'];

// Raisonnement accordé à la lecture des photos : aide à déchiffrer les mots difficiles.
const TRANSCRIPTION_THINKING_BUDGET = parseInt(process.env.GEMINI_THINKING_BUDGET ?? '', 10);
const THINKING_BUDGET = Number.isNaN(TRANSCRIPTION_THINKING_BUDGET) ? 1024 : TRANSCRIPTION_THINKING_BUDGET;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Seuls les modèles 2.5+ acceptent thinkingConfig ; les « pro » imposent un budget d'au moins 128.
function thinkingConfig(model, budget) {
  if (!/gemini-(2\.5|[3-9])/.test(model)) return {};
  return { thinkingConfig: { thinkingBudget: /pro/.test(model) ? Math.max(budget, 128) : budget } };
}

// Convertit les blocs au format OpenAI (text / image_url) en parts Gemini.
function toGeminiParts(content) {
  if (typeof content === 'string') return [{ text: content }];
  return content.map(b => {
    if (b.type === 'text') return { text: b.text };
    const [meta, data] = b.image_url.url.split(',');
    return { inline_data: { mime_type: meta.replace(/^data:|;base64$/g, ''), data } };
  });
}

async function callGemini(model, apiKey, { system, content, maxOutputTokens, thinkingBudget = 0, temperature = 0 }, { maxRetries = 2 } = {}) {
  const url = `${GOOGLE_ENDPOINT}/${model}:generateContent?key=${apiKey}`;

  const thinking = thinkingConfig(model, thinkingBudget);
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: toGeminiParts(content) }],
    generationConfig: {
      temperature,
      // Les tokens de raisonnement sont décomptés de maxOutputTokens.
      maxOutputTokens: Math.min(maxOutputTokens + (thinking.thinkingConfig?.thinkingBudget ?? 0), 65536),
      ...thinking,
    },
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      log.debug(`↻ Gemini ${model} tentative ${attempt + 1}/${maxRetries + 1}`);
    }

    const res = await fetch(url, { signal: llmSignal(),
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

      log.warn(
        `⚠ Gemini ${model} rate limit (429)` +
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
        log.warn(`⚠ Gemini ${model} indisponible (${res.status})`);
        return null;
      }
      throw new Error(`Gemini erreur ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      log.warn(`⚠ Gemini ${model} : aucun candidat retourné`);
      return null;
    }
    if (candidate.finishReason === 'SAFETY') {
      log.warn(`⚠ Gemini ${model} : bloqué par filtre de sécurité`);
      return null;
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      log.warn(`⚠ Gemini ${model} : limite de tokens atteinte (sortie tronquée)`);
    }

    return candidate.content?.parts?.[0]?.text ?? null;
  }

  return null;
}

// Transcription (passe 1) avec Gemini, recoupée si possible par une lecture Ollama.
export async function runGoogleTranscription(imagePaths, { googleKey, vocabulary, corrections, userNote } = {}) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  log.debug(`[google] ${paths.length} image(s), transcription Gemini`);

  const pages = await preparePages(paths);
  const request = {
    system: buildTranscriptionPrompt({ vocabulary, corrections, userNote }),
    content: buildTranscriptionContent(pages),
    maxOutputTokens: Math.min(8192 * paths.length, 65536),
    thinkingBudget: THINKING_BUDGET,
  };

  const ollamaEnabled = (process.env.OLLAMA_VALIDATION ?? 'true') !== 'false';
  const litePromise = ollamaEnabled
    ? callOllamaRaw(paths).catch(() => null)
    : Promise.resolve(null);

  let output = null;
  let modelUsed = null;

  for (const model of GEMINI_PRIMARY_MODELS) {
    log.debug(`→ Gemini ${model}`);
    output = await callGemini(model, googleKey, request, { maxRetries: 2 });
    if (output !== null) {
      modelUsed = model;
      log.debug(`✓ Gemini ${model} → ${output.length} chars`);
      break;
    }
    await sleep(2000);
  }

  // Boucle de répétition : un nouvel essai avec un peu d'aléa suffit souvent à en sortir.
  let loopedPages = [];
  if (output && hasRepetitionLoop(output)) {
    log.warn(`↻ Gemini ${modelUsed} : nouvel essai après une boucle de répétition`);
    const retry = await callGemini(modelUsed, googleKey, { ...request, temperature: 0.4 }, { maxRetries: 1 });
    if (retry && !hasRepetitionLoop(retry)) output = retry;
    else loopedPages = paths.map((_, i) => i + 1);
  }

  const reference = await litePromise;

  if (!output) {
    if (reference) {
      log.warn('⚠ Gemini indisponible → lecture Ollama utilisée');
      return { transcription: finishTranscription(reference), usedFallback: true };
    }
    throw new Error('Gemini indisponible (quota atteint ou modèles inaccessibles).');
  }

  const transcription = finishTranscription(output);
  if (!reference) {
    log.warn('⚠ Aucune référence disponible — Gemini retourné sans validation');
    return { transcription, modelUsed, loopedPages };
  }

  const refSource = `Ollama (${getOllamaConfig().model})`;
  if (isOutputValid(reference, transcription)) {
    log.debug(`✓ Gemini validé par ${refSource}`);
    return { transcription, modelUsed, loopedPages };
  }
  // Désaccord : on garde Gemini sauf s'il a manifestement tronqué sa lecture.
  const keepGemini = transcription.length > 300;
  log.debug(`↩ Gemini rejeté par ${refSource} → ${keepGemini ? 'Gemini conservé' : 'lecture Ollama utilisée'}`);
  return { transcription: keepGemini ? transcription : finishTranscription(reference), modelUsed, usedFallback: true, loopedPages };
}

// Structuration (passe 2) : appel texte, sans raisonnement.
export async function geminiStructure(messages, googleKey, maxOutputTokens) {
  const [system, user] = messages;
  for (const model of GEMINI_PRIMARY_MODELS) {
    const out = await callGemini(model, googleKey, { system: system.content, content: user.content, maxOutputTokens }, { maxRetries: 1 });
    if (out !== null) return cleanFences(out);
    await sleep(2000);
  }
  return null;
}
