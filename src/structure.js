// src/structure.js
import { HISTOIRE_SYSTEM_PROMPT, HISTOIRE_USER_TEMPLATE } from '../prompts/histoire.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = [
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter/auto',
];

const PROMPTS = {
  histoire: { system: HISTOIRE_SYSTEM_PROMPT, userTemplate: HISTOIRE_USER_TEMPLATE },
};

async function callLLM(messages, apiKey, model) {
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://scrip.local',
      'X-Title': 'Scrip',
    },
    body: JSON.stringify({ model, temperature: 0.2, messages }),
  });

  if (response.status === 429) return null;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter erreur ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Envoie le texte OCR brut au LLM via OpenRouter pour structuration markdown.
 * Essaie les modèles de MODELS dans l'ordre, passe au suivant sur 429.
 * @param {string} rawMarkdown - Sortie brute de l'OCR
 * @param {string} subject - Matière (ex: 'histoire')
 * @param {string} level - Niveau scolaire (ex: '1ère')
 * @param {string} apiKey - Clé API OpenRouter
 * @returns {Promise<string>} Markdown structuré
 */
export async function structureContent(rawMarkdown, subject, level, apiKey) {
  const prompt = PROMPTS[subject] ?? PROMPTS['histoire'];
  const messages = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.userTemplate(rawMarkdown) },
  ];

  for (const model of MODELS) {
    process.stderr.write(`    → modèle : ${model}\n`);
    const result = await callLLM(messages, apiKey, model);
    if (result !== null) return result;
    process.stderr.write(`    ⚠ 429 sur ${model}, essai suivant...\n`);
  }

  throw new Error('Tous les modèles LLM sont rate-limited. Réessaie dans quelques minutes.');
}
