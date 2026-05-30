import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_TEMPLATE } from '../../prompts/default.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

const NVIDIA_MODELS = process.env.NVIDIA_STRUCTURE_MODEL
  ? [process.env.NVIDIA_STRUCTURE_MODEL]
  : ['mistralai/mistral-medium-3-instruct', 'meta/llama-4-maverick-17b-128e-instruct', 'nvidia/llama-3.1-nemotron-ultra-253b-v1', 'qwen/qwq-32b'];

const OPENROUTER_MODELS = process.env.OPENROUTER_STRUCTURE_MODEL
  ? [process.env.OPENROUTER_STRUCTURE_MODEL]
  : ['google/gemma-4-26b-a4b-it:free', 'google/gemma-4-31b-it:free', 'openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-coder:free', 'qwen/qwen3-next-80b-a3b-instruct:free', 'nousresearch/hermes-3-llama-3.1-405b:free', 'openai/gpt-oss-120b:free', 'nvidia/nemotron-3-super-120b-a12b:free'];

const PROMPTS = {
  default: { system: DEFAULT_SYSTEM_PROMPT, userTemplate: DEFAULT_USER_TEMPLATE }, histoire: { system: DEFAULT_SYSTEM_PROMPT, userTemplate: DEFAULT_USER_TEMPLATE }, géographie: { system: DEFAULT_SYSTEM_PROMPT, userTemplate: DEFAULT_USER_TEMPLATE }, emc: { system: DEFAULT_SYSTEM_PROMPT, userTemplate: DEFAULT_USER_TEMPLATE },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function calcMaxTokens(ocrText) {
  const ocrTokens = Math.ceil(ocrText.length / 4);
  return Math.min(Math.max(Math.ceil(ocrTokens * 1.4) + 200, 1024), 8192);
}

async function callNvidia(messages, apiKey, model, maxTokens) {
  const res = await fetch(NVIDIA_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }), });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      process.stderr.write(`    ⚠ NVIDIA ${model} indisponible (${res.status}), skip\n`);
      return null;
    }
    throw new Error(`NVIDIA NIM erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

async function callOpenRouter(messages, apiKey, model, maxTokens) {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST', headers: {
      'Content-Type': 'application/json',  'Authorization': `Bearer ${apiKey}`,  'HTTP-Referer': 'https://scrip.local',  'X-Title': 'Scrip', }, body: JSON.stringify({ model, temperature: 0, max_tokens: maxTokens, messages }), });
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || res.status === 400) {
      process.stderr.write(`    ⚠ ${model} indisponible (${res.status}), skip\n`);
      return null;
    }
    throw new Error(`OpenRouter erreur ${res.status}: ${txt}`);
  }
  return (await res.json()).choices[0].message.content;
}

export async function structureContent(rawMarkdown, subject, level, openrouterKey, mistralKey, nvidiaKey) {
  const prompt = PROMPTS[subject] ?? PROMPTS['default'];
  const maxTokens = calcMaxTokens(rawMarkdown);

  process.stderr.write(`    OCR: ${rawMarkdown.length} chars → max_tokens: ${maxTokens}\n`);

  const messages = [
    { role: 'system', content: prompt.system }, { role: 'user', content: prompt.userTemplate(rawMarkdown) }, ];

  if (nvidiaKey) {
    for (const model of NVIDIA_MODELS) {
      process.stderr.write(`    → NVIDIA ${model}\n`);
      const result = await callNvidia(messages, nvidiaKey, model, maxTokens);
      if (result !== null) {
        process.stderr.write(`    ✓ NVIDIA ${model} → ${result.length} chars\n`);
        return result;
      }
      process.stderr.write(`    ⚠ 429 sur NVIDIA ${model}\n`);
      await sleep(1000);
    }
    process.stderr.write(`    ⚠ Tous les modèles NVIDIA en 429 → bascule OpenRouter\n`);
  }

  const RETRY_DELAYS = [0, 3000, 15000];

  for (let round = 0; round < RETRY_DELAYS.length; round++) {
    if (RETRY_DELAYS[round] > 0) {
      process.stderr.write(`    ⏳ attente ${RETRY_DELAYS[round] / 1000}s avant vague ${round + 1}...\n`);
      await sleep(RETRY_DELAYS[round]);
    }
    process.stderr.write(`    ── vague OpenRouter ${round + 1} ──\n`);

    const models = round < 2 ? OPENROUTER_MODELS : ['openrouter/auto'];
    for (const model of models) {
      process.stderr.write(`    → ${model}\n`);
      const result = await callOpenRouter(messages, openrouterKey, model, maxTokens);
      if (result !== null) {
        process.stderr.write(`    ✓ ${model} → ${result.length} chars\n`);
        return result;
      }
      process.stderr.write(`    ⚠ 429 sur ${model}\n`);
      await sleep(800);
    }
  }

  process.stderr.write(`    ⏳ dernier espoir — attente 45s puis openrouter/auto...\n`);
  await sleep(45000);
  const last = await callOpenRouter(messages, openrouterKey, 'openrouter/auto', maxTokens);
  if (last !== null) return last;

  throw new Error('Tous les modèles LLM sont saturés. Réessaie dans quelques minutes.');
}
