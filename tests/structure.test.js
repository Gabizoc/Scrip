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

const { structureContent } = await import('../src/structure.js');

test('structureContent retourne le contenu markdown du LLM', async () => {
  const result = await structureContent(
    'texte brut ocr',
    'histoire',
    '1ère',
    'fake_openrouter_key'
  );
  assert.equal(result, MOCK_STRUCTURED);
});

test('structureContent lève une erreur si le LLM répond avec une erreur HTTP', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 503,
    text: async () => 'Service Unavailable',
  });

  await assert.rejects(
    () => structureContent('texte', 'histoire', '1ère', 'fake_key'),
    /OpenRouter erreur 503/
  );

  global.fetch = originalFetch;
});
