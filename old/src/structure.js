// src/structure.js
import { SHS_SYSTEM_PROMPT, SHS_USER_TEMPLATE } from '../prompts/shs.js';

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const OPENROUTER_FALLBACKS = [
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter/auto',
];

const PROMPTS = {
  histoire:   { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
  géographie: { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
  emc:        { system: SHS_SYSTEM_PROMPT, userTemplate: SHS_USER_TEMPLATE },
};

async function callMistral(messages, apiKey) {
  const response = await fetch(MISTRAL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'mistral-small-latest', temperature: 0.2, messages }),
  });

  if (response.status === 429) return null;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral erreur ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenRouter(messages, apiKey, model) {
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
 * Envoie le texte OCR brut au LLM pour structuration markdown.
 * Essaie d'abord Mistral direct, puis la chaîne OpenRouter sur 429.
 * @param {string} rawMarkdown - Sortie brute de l'OCR
 * @param {string} subject - Matière (ex: 'histoire')
 * @param {string} level - Niveau scolaire (ex: '1ère')
 * @param {string} openrouterKey - Clé API OpenRouter
 * @param {string} mistralKey - Clé API Mistral
 * @returns {Promise<string>} Markdown structuré
 */
export async function structureContent(rawMarkdown, subject, level, openrouterKey, mistralKey) {
  const prompt = PROMPTS[subject] ?? PROMPTS['histoire'];
  const messages = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.userTemplate(rawMarkdown) },
  ];

  process.stderr.write(`    → mistral-small-latest (direct)\n`);
  const mistralResult = await callMistral(messages, mistralKey);
  if (mistralResult !== null) return mistralResult;
  process.stderr.write(`    ⚠ 429 sur Mistral, bascule OpenRouter...\n`);

  for (const model of OPENROUTER_FALLBACKS) {
    process.stderr.write(`    → ${model}\n`);
    const result = await callOpenRouter(messages, openrouterKey, model);
    if (result !== null) return result;
    process.stderr.write(`    ⚠ 429 sur ${model}, essai suivant...\n`);
  }

  throw new Error('Tous les modèles LLM sont rate-limited. Réessaie dans quelques minutes.');
}
