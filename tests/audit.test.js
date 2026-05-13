// tests/audit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCorrections, writeAuditLog } from '../backend/src/pipeline/audit.js';

// --- parseCorrections ---

test('parseCorrections détecte une correction factuelle', () => {
  const content = `## I- Contexte
Napoléon prend le pouvoir [Note : "4589" corrigé en "1589" — date aberrante] lors du coup d'État.`;

  const result = parseCorrections(content);
  assert.equal(result.length, 1);
  assert.equal(result[0].original, '4589');
  assert.equal(result[0].corrected, '1589');
  assert.equal(result[0].reason, 'date aberrante');
});

test('parseCorrections détecte plusieurs corrections', () => {
  const content = `[Note : "Napleon" corrigé en "Napoléon" — nom propre] et [Note : "1790" corrigé en "1789" — date Révolution]`;
  const result = parseCorrections(content);
  assert.equal(result.length, 2);
});

test('parseCorrections retourne [] si aucune correction', () => {
  const content = `# Cours\n\n## I- Contexte\n\nTexte sans correction.`;
  const result = parseCorrections(content);
  assert.deepEqual(result, []);
});

test("parseCorrections accepte tiret demi-cadratin et trait d'union", () => {
  const c1 = `[Note : "a" corrigé en "b" – raison en dash]`;
  const c2 = `[Note : "c" corrigé en "d" - raison hyphen]`;
  assert.equal(parseCorrections(c1).length, 1);
  assert.equal(parseCorrections(c2).length, 1);
});

// --- writeAuditLog ---

test('writeAuditLog retourne null si pas de corrections et pas de régions', () => {
  const result = writeAuditLog('# Cours\n\nContenu propre.', [], 'cours_histoire.jpg', '2026-05-12T18:00:00.000Z');
  assert.equal(result, null);
});

test('writeAuditLog crée un fichier si correction présente', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'scrip-audit-test-'));
  const origCwd = process.cwd();
  process.chdir(tmpBase);

  try {
    const content = `# Cours\n[Note : "4589" corrigé en "1589" — date aberrante]`;
    const result = writeAuditLog(content, [], 'cours_histoire.jpg', '2026-05-12T18:00:00.000Z');

    assert.ok(result !== null, 'doit retourner un chemin de fichier');
    assert.ok(fs.existsSync(result), 'le fichier doit exister');
    const text = fs.readFileSync(result, 'utf8');
    assert.ok(text.includes('4589'), "doit contenir l'original");
    assert.ok(text.includes('1589'), 'doit contenir le corrigé');
    assert.ok(text.includes('date aberrante'), 'doit contenir la raison');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpBase, { recursive: true });
  }
});

test('writeAuditLog crée un fichier si régions non-textuelles présentes', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'scrip-audit-test-'));
  const origCwd = process.cwd();
  process.chdir(tmpBase);

  try {
    const regions = [{ id: 'img-0.jpeg', x1: 10, y1: 20, x2: 200, y2: 150 }];
    const result = writeAuditLog('# Cours\n\nContenu sans correction.', regions, 'cours_geo.jpg', '2026-05-12T18:00:00.000Z');

    assert.ok(result !== null, 'doit créer un fichier pour les régions');
    const text = fs.readFileSync(result, 'utf8');
    assert.ok(text.includes('img-0.jpeg'), "doit mentionner l'id de la région");
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpBase, { recursive: true });
  }
});

test("writeAuditLog nomme le fichier d'après le nom source sans extension", () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'scrip-audit-test-'));
  const origCwd = process.cwd();
  process.chdir(tmpBase);

  try {
    const content = `[Note : "a" corrigé en "b" — test]`;
    const result = writeAuditLog(content, [], 'IMG_2406.jpeg', '2026-05-12T18:00:00.000Z');
    assert.ok(result.includes('IMG_2406'), 'le nom de fichier doit contenir le nom source');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpBase, { recursive: true });
  }
});
