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

// Reset auth state for subsequent tests
db.data.settings.auth.passwordHash      = null;
db.data.settings.auth.pendingSetupToken = null;
db.data.settings.auth.pendingResetToken = null;
db.data.settings.auth.pendingMagicToken = null;
db.data.settings.webdav.passwordHash    = null;
await db.write();

const { default: supertest } = await import('supertest');
const { createApp }          = await import('../src/app.js');

const request = supertest(createApp());

test('requireAuth : 401 sans session', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Non authentifié');
});
