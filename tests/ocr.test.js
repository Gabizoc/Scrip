// tests/ocr.test.js
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch before importing the module under test
const mockFetch = mock.fn(async () => ({
  ok: true,
  json: async () => ({
    pages: [
      {
        markdown: '# Cours de la Révolution\n\nTexte du cours.',
        images: [
          { id: 'img-0.jpeg', top_left_x: 10, top_left_y: 20, bottom_right_x: 200, bottom_right_y: 150 },
        ],
      },
    ],
  }),
}));

global.fetch = mockFetch;

const { runOCR } = await import('../src/ocr.js');

test('runOCR retourne rawMarkdown et imageRegions', async () => {
  const result = await runOCR('tests/fixtures/dummy.jpg', 'fake_api_key');

  assert.equal(typeof result.rawMarkdown, 'string', 'rawMarkdown doit être une string');
  assert.ok(result.rawMarkdown.includes('Révolution'), 'rawMarkdown doit contenir le texte OCR');
  assert.equal(Array.isArray(result.imageRegions), true, 'imageRegions doit être un tableau');
  assert.equal(result.imageRegions.length, 1, 'doit détecter 1 région image');
  assert.deepEqual(result.imageRegions[0], { id: 'img-0.jpeg', x1: 10, y1: 20, x2: 200, y2: 150 });
});

test('runOCR lève une erreur si la réponse API échoue', async () => {
  // Override global.fetch temporarily for this test
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 429, text: async () => 'Rate limit exceeded' });

  await assert.rejects(
    () => runOCR('tests/fixtures/dummy.jpg', 'fake_key'),
    /Mistral OCR erreur 429/
  );

  global.fetch = originalFetch; // restore
});
