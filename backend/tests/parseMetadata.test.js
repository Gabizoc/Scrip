// backend/tests/parseMetadata.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../src/pipeline/audit.js';

const SAMPLE = `# Un cours

Texte du cours.

<!-- METADATA
qualite_francais: 78
nb_fautes_orthographe: 3
nb_fautes_grammaire: 2
nb_fautes_syntaxe: 1
commentaire: "Bonne qualité globale."
-->`;

test('parseMetadata extrait les champs numériques et texte', () => {
  const result = parseMetadata(SAMPLE);
  assert.equal(result.qualite_francais, 78);
  assert.equal(result.nb_fautes_orthographe, 3);
  assert.equal(result.commentaire, 'Bonne qualité globale.');
});

test('parseMetadata retourne null si pas de bloc METADATA', () => {
  assert.equal(parseMetadata('# Cours sans metadata'), null);
});

test('parseMetadata gère un bloc vide', () => {
  const result = parseMetadata('<!-- METADATA\n-->');
  assert.deepEqual(result, {});
});
