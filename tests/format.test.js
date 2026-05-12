// tests/format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNote } from '../src/format.js';

test('buildNote génère un frontmatter YAML valide', () => {
  const meta = {
    subject: 'histoire',
    level: '1ère',
    dateCours: '2026-05-12',
    dateIngestion: '2026-05-12T18:00:00+02:00',
    sources: ['photo_01.jpg'],
  };
  const content = '## La Révolution française\n\nTexte du cours.';
  const note = buildNote(content, meta);

  assert.ok(note.startsWith('---\n'), 'doit commencer par ---');
  assert.ok(note.includes("matière: histoire"), 'doit contenir la matière');
  assert.ok(note.includes("niveau: 1ère"), 'doit contenir le niveau');
  assert.ok(note.includes("date_cours: 2026-05-12"), 'doit contenir la date cours');
  assert.ok(note.includes('## La Révolution française'), 'doit contenir le contenu');
});

test('buildNote insère les sources comme liste YAML', () => {
  const meta = {
    subject: 'histoire',
    level: '1ère',
    dateCours: '2026-05-12',
    dateIngestion: '2026-05-12T18:00:00+02:00',
    sources: ['photo_01.jpg', 'photo_02.jpg'],
  };
  const note = buildNote('# Titre\n\nContenu.', meta);
  assert.ok(note.includes('sources: [photo_01.jpg, photo_02.jpg]'), 'sources en liste inline YAML');
});
