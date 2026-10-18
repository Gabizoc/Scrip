import { log } from '../lib/logger.js';
import { llmSignal } from './http.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

const NVIDIA_MODELS = process.env.NVIDIA_STRUCTURE_MODEL
  ? [process.env.NVIDIA_STRUCTURE_MODEL]
  : ['mistralai/mistral-medium-3-instruct', 'meta/llama-4-maverick-17b-128e-instruct', 'nvidia/llama-3.1-nemotron-ultra-253b-v1', 'qwen/qwq-32b'];

// Routeur OpenRouter vers un modèle gratuit tiré au hasard : qualité variable, donc dernier recours
// (contrairement à openrouter/auto, il ne choisit jamais de modèle payant).
const FREE_ROUTER = 'openrouter/free';

const OPENROUTER_MODELS = process.env.OPENROUTER_STRUCTURE_MODEL
  ? [process.env.OPENROUTER_STRUCTURE_MODEL]
  : ['google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-coder:free', 'qwen/qwen3-next-80b-a3b-instruct:free', 'nousresearch/hermes-3-llama-3.1-405b:free', 'openai/gpt-oss-120b:free', 'nvidia/nemotron-3-super-120b-a12b:free', FREE_ROUTER];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callNvidia(messages, apiKey, model, maxTokens) {
  const res = await fetch(NVIDIA_ENDPOINT, { signal: llmSignal(),
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }), });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      log.warn(`⚠ NVIDIA ${model} indisponible (${res.status}), skip`);
      return null;
    }
    throw new Error(`NVIDIA NIM erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

async function callOpenRouter(messages, apiKey, model, maxTokens) {
  const res = await fetch(OPENROUTER_ENDPOINT, { signal: llmSignal(),
    method: 'POST', headers: {
      'Content-Type': 'application/json',  'Authorization': `Bearer ${apiKey}`,  'HTTP-Referer': 'https://scrip.local',  'X-Title': 'Scrip', }, body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }), });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      log.warn(`⚠ ${model} indisponible (${res.status}), skip`);
      return null;
    }
    throw new Error(`OpenRouter erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

// Structuration (passe 2) via NVIDIA puis OpenRouter : messages vient de buildStructureMessages().
export async function structureContent(messages, { openrouterKey, nvidiaKey, maxTokens } = {}) {
  log.debug(`structuration → max_tokens: ${maxTokens}`);

  if (nvidiaKey) {
    for (const model of NVIDIA_MODELS) {
      log.debug(`→ NVIDIA ${model}`);
      const result = await callNvidia(messages, nvidiaKey, model, maxTokens);
      if (result !== null) {
        log.debug(`✓ NVIDIA ${model} → ${result.length} chars`);
        return result;
      }
      log.warn(`⚠ 429 sur NVIDIA ${model}`);
      await sleep(1000);
    }
    log.warn(`⚠ Tous les modèles NVIDIA en 429 → bascule OpenRouter`);
  }

  if (!openrouterKey) {
    throw new Error('Structuration impossible : aucun modèle NVIDIA disponible et OPENROUTER_API_KEY absente.');
  }

  const RETRY_DELAYS = [0, 3000, 15000];

  for (let round = 0; round < RETRY_DELAYS.length; round++) {
    if (RETRY_DELAYS[round] > 0) {
      log.debug(`⏳ attente ${RETRY_DELAYS[round] / 1000}s avant vague ${round + 1}...`);
      await sleep(RETRY_DELAYS[round]);
    }
    log.debug(`── vague OpenRouter ${round + 1} ──`);

    const models = round < 2 ? OPENROUTER_MODELS : [FREE_ROUTER];
    for (const model of models) {
      log.debug(`→ ${model}`);
      const result = await callOpenRouter(messages, openrouterKey, model, maxTokens);
      if (result !== null) {
        log.debug(`✓ ${model} → ${result.length} chars`);
        return result;
      }
      log.warn(`⚠ 429 sur ${model}`);
      await sleep(800);
    }
  }

  log.debug(`⏳ dernier espoir — attente 45s puis ${FREE_ROUTER}...`);
  await sleep(45000);
  const last = await callOpenRouter(messages, openrouterKey, FREE_ROUTER, maxTokens);
  if (last !== null) return last;

  throw new Error('Tous les modèles LLM sont saturés. Réessaie dans quelques minutes.');
}
