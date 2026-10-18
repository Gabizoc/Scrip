import { log } from '../lib/logger.js';
import { llmSignal } from './http.js';
import { preparePages } from './image.js';
import { runOCR } from './ocr.js';
import { isOutputValid } from './format-rules.js';
import { buildTranscriptionPrompt, buildTranscriptionContent, finishTranscription } from './transcribe.js';

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const NVIDIA_VISION_MODELS = process.env.NVIDIA_VISION_MODEL
  ? [process.env.NVIDIA_VISION_MODEL]
  : ['nvidia/llama-3.2-90b-vision-instruct'];

const OPENROUTER_VISION_MODELS = process.env.OPENROUTER_VISION_MODEL
  ? [process.env.OPENROUTER_VISION_MODEL]
  : ['google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free', 'openrouter/free'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callNvidiaVision(messages, apiKey, model, maxTokens) {
  const res = await fetch(NVIDIA_ENDPOINT, { signal: llmSignal(),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }),
  });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      log.warn(`⚠ NVIDIA vision ${model} indisponible (${res.status})`);
      return null;
    }
    throw new Error(`NVIDIA vision erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

async function callOpenRouterVision(messages, apiKey, model, maxTokens) {
  const res = await fetch(OPENROUTER_ENDPOINT, { signal: llmSignal(),
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
      log.warn(`⚠ OpenRouter vision ${model} indisponible (${res.status})`);
      return null;
    }
    throw new Error(`OpenRouter vision erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

// Transcription (passe 1) avec un modèle vision NVIDIA, recoupée par l'OCR Mistral si sa clé est définie.
export async function runVisionTranscription(imagePaths, { nvidiaKey, openrouterKey, mistralKey, vocabulary, corrections, userNote } = {}) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  log.debug(`[vision] ${paths.length} image(s), transcription vision`);

  const hints = { vocabulary, corrections, userNote };
  // Llama 3.2 Vision n'accepte qu'une image par requête : une page entière par appel.
  const pages = await preparePages(paths, { tiling: false });
  const system = { role: 'system', content: buildTranscriptionPrompt(hints) };
  const messagesFor = (i) => [system, { role: 'user', content: buildTranscriptionContent([pages[i]], { firstPage: i + 1, totalPages: paths.length }) }];

  const ocrPromise = mistralKey
    ? runOCR(paths, mistralKey, hints).then(r => r.rawMarkdown).catch(err => {
        log.warn(`⚠ OCR parallèle échoué (${err.message}), validation désactivée`);
        return null;
      })
    : Promise.resolve(null);

  async function transcribePage(i) {
    if (nvidiaKey) {
      for (const model of NVIDIA_VISION_MODELS) {
        log.debug(`→ NVIDIA vision ${model} [${i + 1}/${paths.length}]`);
        const out = await callNvidiaVision(messagesFor(i), nvidiaKey, model, 4096);
        if (out !== null) return finishTranscription(out);
        await sleep(1000);
      }
    }
    if (openrouterKey) {
      for (const model of OPENROUTER_VISION_MODELS) {
        log.debug(`→ OpenRouter vision ${model} [${i + 1}/${paths.length}]`);
        const out = await callOpenRouterVision(messagesFor(i), openrouterKey, model, 4096);
        if (out !== null) return finishTranscription(out);
        await sleep(800);
      }
    }
    return null;
  }

  let visionOutput = [];
  for (let i = 0; i < paths.length && visionOutput; i++) {
    const page = await transcribePage(i);
    visionOutput = page === null ? null : [...visionOutput, page];
  }

  const ocrReference = await ocrPromise;

  if (!visionOutput) {
    if (ocrReference) {
      log.warn('⚠ Modèle vision indisponible → transcription Mistral utilisée');
      return { transcription: ocrReference, usedFallback: true };
    }
    throw new Error('Aucun modèle vision disponible. Passe en mode PIPELINE_MODE=mistral et réessaie.');
  }

  const transcription = visionOutput.join('\n\n');
  log.debug(`✓ vision → ${transcription.length} chars`);

  if (!ocrReference) {
    log.warn(`⚠ Validation désactivée (pas de clé Mistral ou OCR échoué)`);
    return { transcription };
  }

  log.debug(`[validation] OCR référence: ${ocrReference.length} chars`);
  if (isOutputValid(ocrReference, transcription)) return { transcription };
  log.debug(`↩ Vision rejetée → transcription Mistral utilisée`);
  return { transcription: ocrReference, usedFallback: true };
}
