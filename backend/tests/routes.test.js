// backend/tests/routes.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Utiliser une db temporaire pour les tests
const tmpDb = path.join(os.tmpdir(), `scrip-test-${Date.now()}.json`);
process.env.DB_PATH = tmpDb;

const { default: supertest } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { initDb } = await import('../src/db.js');

let request;

before(async () => {
  await initDb();
  request = supertest(createApp());
});

after(() => {
  if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
});

// ── Settings ────────────────────────────────────────────────
test('GET /api/settings retourne les settings par défaut', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.theme, 'auto');
});

test('PUT /api/settings met à jour le thème', async () => {
  const res = await request.put('/api/settings').send({ theme: 'dark' });
  assert.equal(res.status, 200);
  assert.equal(res.body.theme, 'dark');
});

// ── Levels ──────────────────────────────────────────────────
test('POST /api/levels crée un niveau', async () => {
  const res = await request.post('/api/levels').send({ name: '1ère' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, '1ère');
  assert.ok(res.body.id);
});

test('POST /api/levels — 400 si name manquant', async () => {
  const res = await request.post('/api/levels').send({});
  assert.equal(res.status, 400);
});

test('GET /api/levels liste les niveaux', async () => {
  const res = await request.get('/api/levels');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 1);
});

test('DELETE /api/levels/:id — 409 si matières liées', async () => {
  const lvl = (await request.post('/api/levels').send({ name: 'Test' })).body;
  await request.post('/api/subjects').send({
    name: 'Histoire', levelId: lvl.id, prompt: 'shs', outputFolder: 'Histoire',
  });
  const res = await request.delete(`/api/levels/${lvl.id}`);
  assert.equal(res.status, 409);
});
