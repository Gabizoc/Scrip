// backend/src/pipeline/summarize.js
const OPENROUTER_URL  = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL           = 'google/gemma-4-26b-a4b-it:free';
const MAX_INPUT_CHARS = 3000;   // taille max du contenu envoyé au LLM
const MAX_TOKENS      = 200;    // tokens max pour un résumé de 2-3 phrases
const MIN_CONTENT_LEN = 80;     // contenu trop court → pas de résumé
const MIN_RESULT_LEN  = 15;     // réponse trop courte → invalide
const TEMPERATURE     = 0.3;
const TIMEOUT_MS      = 30_000; // 30 secondes

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
  if (content.length < MIN_CONTENT_LEN) return null;

  const userPrompt =
    `Tu es un assistant pour lycéens français (niveau ${level}).\n` +
    `Résume ce cours en 2 à 3 phrases claires et concises en français.\n` +
    `Ne commence pas par "Ce cours" ou "Le cours". Réponds uniquement avec le résumé.\n\n` +
    content.slice(0, MAX_INPUT_CHARS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
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
      process.stderr.write(`[summarize] HTTP ${res.status} from OpenRouter\n`);
      return null;
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    return text.length > MIN_RESULT_LEN ? text : null;
  } catch (err) {
    if (err.name === 'AbortError') {
      process.stderr.write('[summarize] timeout après 30s\n');
    } else {
      process.stderr.write(`[summarize] erreur: ${err.message}\n`);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
