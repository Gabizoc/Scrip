const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_SUMMARY_MODEL ?? 'google/gemma-4-26b-a4b-it:free';
const MAX_INPUT_CHARS = 3000;
const MAX_TOKENS = 200;
const MIN_CONTENT_LEN = 80;
const MIN_RESULT_LEN = 15;
const TEMPERATURE = 0.3;
const TIMEOUT_MS = 30_000;

export async function summarizeNote(markdown, level, apiKey) {
  if (!apiKey) return null;

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
