// tests/structure.test.js
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const MOCK_STRUCTURED = '# La Révolution française\n\n## Contexte\n\nTexte structuré.';

global.fetch = mock.fn(async () => ({
  ok: true,
  json: async () => ({
    choices: [{ message: { content: MOCK_STRUCTURED } }],
  }),
}));

const { structureContent } = await import('../backend/src/pipeline/structure.js');

test('structureContent retourne le contenu markdown du LLM (Mistral direct)', async () => {
  const result = await structureContent(
    'texte brut ocr',
    'histoire',
    '1ère',
    'fake_openrouter_key',
    'fake_mistral_key'
  );
  assert.equal(result, MOCK_STRUCTURED);
});

test('structureContent bascule sur OpenRouter si Mistral retourne 429', async () => {
  let callCount = 0;
  global.fetch = mock.fn(async () => {
    callCount++;
    // Premier appel (Mistral) → 429
    if (callCount === 1) return { ok: false, status: 429, text: async () => 'Rate limit' };
    // Deuxième appel (OpenRouter fallback) → succès
    return { ok: true, json: async () => ({ choices: [{ message: { content: MOCK_STRUCTURED } }] }) };
  });

  const result = await structureContent('texte', 'histoire', '1ère', 'fake_or_key', 'fake_mistral_key');
  assert.equal(result, MOCK_STRUCTURED);
  assert.equal(callCount, 2, 'doit avoir fait exactement 2 appels fetch');
});

test('structureContent lève une erreur non-429 immédiatement', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'Service Unavailable',
  });

  await assert.rejects(
    () => structureContent('texte', 'histoire', '1ère', 'fake_key', 'fake_key'),
    /Mistral erreur 503/
  );
});
