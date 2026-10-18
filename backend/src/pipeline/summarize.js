import { llmSignal } from './http.js';
import { isOllamaConfigured, ollamaChat } from './ollama.js';
import { log } from '../lib/logger.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_SUMMARY_MODEL ?? 'google/gemma-4-26b-a4b-it:free';
const MAX_INPUT_CHARS = 3000;
const MAX_TOKENS = 200;
const MIN_CONTENT_LEN = 80;
const MIN_RESULT_LEN = 15;
const TEMPERATURE = 0.3;
const TIMEOUT_MS = 30_000;

async function summarizeWithOpenRouter(userPrompt, apiKey) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal: llmSignal(TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://scrip.local',
      'X-Title': 'Scrip',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    }),
  });

  if (!res.ok) {
    log.warn(`[summarize] HTTP ${res.status} from OpenRouter`);
    return null;
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

async function summarizeWithOllama(userPrompt) {
  return (await ollamaChat([{ role: 'user', content: userPrompt }], MAX_TOKENS))?.trim() ?? '';
}

// Résumé court de la note : OpenRouter si une clé est fournie, avec repli sur Ollama s'il est configuré
// (quota OpenRouter atteint, erreur HTTP, réponse vide).
export async function summarizeNote(markdown, level, openrouterKey) {
  if (!openrouterKey && !isOllamaConfigured()) return null;

  const content = markdown.replace(/^---[\s\S]*?---\s*\n/, '').trim();
  if (content.length < MIN_CONTENT_LEN) return null;

  const userPrompt =
    `Tu es un assistant pour lycéens français (niveau ${level}).\n` +
    `Résume ce cours en 2 à 3 phrases claires et concises en français.\n` +
    `Ne commence pas par "Ce cours" ou "Le cours". Réponds uniquement avec le résumé.\n\n` +
    content.slice(0, MAX_INPUT_CHARS);

  try {
    let text = openrouterKey
      ? await summarizeWithOpenRouter(userPrompt, openrouterKey).catch((err) => {
        log.warn(`[summarize] OpenRouter : ${err.name === 'TimeoutError' ? 'timeout' : err.message}`);
        return null;
      })
      : null;
    if ((text?.length ?? 0) <= MIN_RESULT_LEN && isOllamaConfigured()) {
      if (openrouterKey) log.info('[summarize] repli sur Ollama');
      text = await summarizeWithOllama(userPrompt);
    }
    return (text?.length ?? 0) > MIN_RESULT_LEN ? text : null;
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      log.warn('[summarize] timeout');
    } else {
      log.warn(`[summarize] erreur: ${err.message}`);
    }
    return null;
  }
}
