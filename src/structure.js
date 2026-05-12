// src/structure.js
import { HISTOIRE_SYSTEM_PROMPT, HISTOIRE_USER_TEMPLATE } from '../prompts/histoire.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PRIMARY_MODEL = 'google/gemma-4-26b-a4b-it:free';

const PROMPTS = {
  histoire: { system: HISTOIRE_SYSTEM_PROMPT, userTemplate: HISTOIRE_USER_TEMPLATE },
};

/**
 * Envoie le texte OCR brut à Gemma 4 via OpenRouter pour structuration markdown.
 * @param {string} rawMarkdown - Sortie brute de l'OCR
 * @param {string} subject - Matière (ex: 'histoire')
 * @param {string} level - Niveau scolaire (ex: '1ère')
 * @param {string} apiKey - Clé API OpenRouter
 * @returns {Promise<string>} Markdown structuré
 */
export async function structureContent(rawMarkdown, subject, level, apiKey) {
  const prompt = PROMPTS[subject] ?? PROMPTS['histoire'];

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://scrip.local',
      'X-Title': 'Scrip',
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.userTemplate(rawMarkdown) },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter erreur ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
