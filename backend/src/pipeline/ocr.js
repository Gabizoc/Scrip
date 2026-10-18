import { log } from '../lib/logger.js';
import { llmSignal } from './http.js';
import { preparePages } from './image.js';
import { buildTranscriptionPrompt, buildTranscriptionContent, finishTranscription } from './transcribe.js';

const MISTRAL_CHAT_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const VISION_MODEL = process.env.MISTRAL_OCR_MODEL ?? 'pixtral-large-latest';

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { ...options, signal: llmSignal() });
    if (res.status !== 429) return res;

    const wait = attempt * 15_000;
    log.warn(`[ocr] 429 rate limit — attente ${wait / 1000}s (tentative ${attempt}/${maxRetries})`);
    await new Promise(r => setTimeout(r, wait));
  }
  return fetch(url, { ...options, signal: llmSignal() });
}

// Transcription (passe 1) avec le modèle vision de Mistral.
export async function runOCR(imagePaths, apiKey, { vocabulary, corrections, userNote } = {}) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  log.debug(`[ocr] modèle : ${VISION_MODEL}`);
  log.debug(`[ocr] apiKey reçue : ${apiKey ? 'présente' : 'UNDEFINED/NULL'}`);
  log.debug(`[ocr] pages : ${paths.length}`);

  const pages = await preparePages(paths);

  const response = await fetchWithRetry(MISTRAL_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: buildTranscriptionPrompt({ vocabulary, corrections, userNote }) },
        { role: 'user', content: buildTranscriptionContent(pages) },
      ],
      temperature: 0,
      max_tokens: 4096 * Math.min(paths.length, 3),
    }),
  });

  log.debug(`[ocr] réponse HTTP : ${response.status} ${response.statusText}`);
  if (!response.ok) {
    const errorText = await response.text();
    log.debug(`[ocr] corps erreur : ${errorText}`);
    throw new Error(`Mistral OCR erreur ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return { rawMarkdown: finishTranscription(data.choices[0].message.content), imageRegions: [] };
}
