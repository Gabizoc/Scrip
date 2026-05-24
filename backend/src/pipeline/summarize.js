// backend/src/pipeline/summarize.js
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemma-4-26b-a4b-it:free';

/**
 * Génère un résumé de 2-3 phrases à partir du markdown d'une note.
 * Retourne une string ou null si l'appel échoue / le résultat est invalide.
 *
 * @param {string} markdown  — contenu complet de la note (avec YAML frontmatter)
 * @param {string} level     — niveau scolaire ex: "1ère"
 * @param {string} apiKey    — clé OpenRouter
 * @returns {Promise<string|null>}
 */
export async function summarizeNote(markdown, level, apiKey) {
  if (!apiKey) return null;

  // Retire le frontmatter YAML
  const content = markdown.replace(/^---[\s\S]*?---\s*\n/, '').trim();
  if (content.length < 80) return null;

  const userPrompt =
    `Tu es un assistant pour lycéens français (niveau ${level}).\n` +
    `Résume ce cours en 2 à 3 phrases claires et concises en français.\n` +
    `Ne commence pas par "Ce cours" ou "Le cours". Réponds uniquement avec le résumé.\n\n` +
    content.slice(0, 3000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://scrip.local',
        'X-Title': 'Scrip',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    return text.length > 15 ? text : null;
  } catch {
    return null;
  }
}
