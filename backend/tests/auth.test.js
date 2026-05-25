// backend/tests/auth.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDb = path.join(os.tmpdir(), `scrip-auth-test-${Date.now()}.json`);
process.env.DB_PATH        = tmpDb;
process.env.SESSION_SECRET = 'test-secret-min-32-chars-padding!!';
process.env.AUTH_EMAIL     = 'test@example.com';
process.env.SMTP_HOST      = 'localhost';
process.env.SMTP_PORT      = '9999';
process.env.SMTP_USER      = 'test';
process.env.SMTP_PASS      = 'test';
process.env.SMTP_FROM      = 'Scrip <test@example.com>';

const { initDb, db } = await import('../src/db.js');

before(async () => { await initDb(); });
after(() => { if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb); });

test('db.data.settings.auth a les valeurs par défaut', () => {
  assert.deepEqual(db.data.settings.auth, {
    passwordHash:       null,
    pendingSetupToken:  null,
    pendingResetToken:  null,
    pendingMagicToken:  null,
  });
});

test('migration : webdav.passwordHash copié vers auth.passwordHash si auth est vide', async () => {
  // Simuler un db existant avec webdav.passwordHash
  db.data.settings.webdav.passwordHash = '$2b$10$fakehash';
  db.data.settings.auth.passwordHash   = null;
  await db.write();
  await initDb();
  assert.equal(db.data.settings.auth.passwordHash, '$2b$10$fakehash');
});

// Reset auth state for subsequent tests (runs sequentially after migration test)
test('reset : état auth remis à zéro pour les tests suivants', async () => {
  db.data.settings.auth.passwordHash      = null;
  db.data.settings.auth.pendingSetupToken = null;
  db.data.settings.auth.pendingResetToken = null;
  db.data.settings.auth.pendingMagicToken = null;
  db.data.settings.webdav.passwordHash    = null;
  await db.write();
  assert.equal(db.data.settings.auth.passwordHash, null);
});

const { default: supertest } = await import('supertest');
const { createApp }          = await import('../src/app.js');

const request = supertest(createApp());

test('requireAuth : 401 sans session', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Non authentifié');
});

// ── Tests routes auth ────────────────────────────────────────────────────────

test('GET /api/auth/status → needsSetup: true initialement', async () => {
  const res = await request.get('/api/auth/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.loggedIn,    false);
  assert.equal(res.body.needsSetup,  true);
});

test('POST /api/auth/setup-request → stocke token en db, retourne 200', async () => {
  const res = await request.post('/api/auth/setup-request');
  assert.equal(res.status, 200);
  await db.read();
  assert.ok(db.data.settings.auth.pendingSetupToken?.token, 'token doit être présent');
  assert.ok(db.data.settings.auth.pendingSetupToken?.expiresAt > Date.now(), 'expiry dans le futur');
});

test('POST /api/auth/setup-complete avec token valide → crée passwordHash + session', async () => {
  await db.read();
  const token = db.data.settings.auth.pendingSetupToken.token;
  const agent = supertest.agent(createApp());
  const res = await agent.post('/api/auth/setup-complete').send({ token, password: 'motdepasse123' });
  assert.equal(res.status, 200);
  await db.read();
  assert.ok(db.data.settings.auth.passwordHash, 'passwordHash doit être défini');
  assert.equal(db.data.settings.auth.pendingSetupToken, null, 'token doit être consommé');
  const statusRes = await agent.get('/api/auth/status');
  assert.equal(statusRes.body.loggedIn, true);
});

test('POST /api/auth/setup-request une 2e fois → 403 (setup déjà fait)', async () => {
  const res = await request.post('/api/auth/setup-request');
  assert.equal(res.status, 403);
});

test('POST /api/auth/login avec bon email+mdp → session', async () => {
  const agent = supertest.agent(createApp());
  const res = await agent.post('/api/auth/login').send({
    email:    'test@example.com',
    password: 'motdepasse123',
  });
  assert.equal(res.status, 200);
  const status = await agent.get('/api/auth/status');
  assert.equal(status.body.loggedIn, true);
});

test('POST /api/auth/login avec mauvais mdp → 401', async () => {
  const res = await request.post('/api/auth/login').send({
    email:    'test@example.com',
    password: 'mauvais',
  });
  assert.equal(res.status, 401);
});

test('POST /api/auth/login avec mauvais email → 401', async () => {
  const res = await request.post('/api/auth/login').send({
    email:    'attaquant@evil.com',
    password: 'motdepasse123',
  });
  assert.equal(res.status, 401);
});

test('POST /api/auth/forgot → stocke pendingResetToken en db', async () => {
  const res = await request.post('/api/auth/forgot');
  assert.equal(res.status, 200);
  await db.read();
  assert.ok(db.data.settings.auth.pendingResetToken?.token);
});

test('POST /api/auth/reset avec token valide → nouveau passwordHash', async () => {
  await db.read();
  const token = db.data.settings.auth.pendingResetToken.token;
  const res = await request.post('/api/auth/reset').send({ token, password: 'nouveaumdp456' });
  assert.equal(res.status, 200);
  await db.read();
  assert.equal(db.data.settings.auth.pendingResetToken, null);
  const loginRes = await request.post('/api/auth/login').send({
    email: 'test@example.com', password: 'nouveaumdp456',
  });
  assert.equal(loginRes.status, 200);
});

test('POST /api/auth/magic → stocke pendingMagicToken en db', async () => {
  const res = await request.post('/api/auth/magic');
  assert.equal(res.status, 200);
  await db.read();
  assert.ok(db.data.settings.auth.pendingMagicToken?.token);
});

test('GET /api/auth/magic/:token → session + redirect /', async () => {
  await db.read();
  const token = db.data.settings.auth.pendingMagicToken.token;
  const agent = supertest.agent(createApp());
  const res = await agent.get(`/api/auth/magic/${token}`).redirects(0);
  assert.ok([301, 302, 303].includes(res.status), `attendu redirect, reçu ${res.status}`);
  await db.read();
  assert.equal(db.data.settings.auth.pendingMagicToken, null, 'token consommé');
});

test('POST /api/auth/logout → détruit la session', async () => {
  const agent = supertest.agent(createApp());
  await agent.post('/api/auth/login').send({ email: 'test@example.com', password: 'nouveaumdp456' });
  const before = await agent.get('/api/auth/status');
  assert.equal(before.body.loggedIn, true);
  await agent.post('/api/auth/logout');
  const after = await agent.get('/api/auth/status');
  assert.equal(after.body.loggedIn, false);
});
