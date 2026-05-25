// backend/tests/webdav.test.js
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const tmpDb = path.join(os.tmpdir(), `scrip-webdav-test-${Date.now()}.json`);
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

test('db.data.settings a webdav et publicUrl par défaut', async () => {
  assert.deepEqual(db.data.settings.webdav, {
    enabled:      false,
    username:     'scrip',
    passwordHash: null,
  });
  assert.equal(db.data.settings.publicUrl, '');
});

const { default: supertest } = await import('supertest');
const { createApp }          = await import('../src/app.js');

const request = supertest(createApp());

test('GET /api/auth/status ne renvoie pas passwordHash mais expose needsSetup', async () => {
  const res = await request.get('/api/auth/status');
  assert.equal(res.status, 200);
  assert.ok('needsSetup' in res.body);
  assert.ok(!('passwordHash' in res.body));
});

test('PUT /api/settings retourne 401 sans session', async () => {
  const res = await request.put('/api/settings').send({ publicUrl: 'https://test.com' });
  assert.equal(res.status, 401);
});

describe('WebDAV auth middleware', () => {
  const tmpVault = path.join(os.tmpdir(), `scrip-vault-${Date.now()}`);

  before(async () => {
    fs.mkdirSync(tmpVault, { recursive: true });
    // Configurer auth.passwordHash directement en db (sans passer par l'API)
    const hash = await bcrypt.hash('testpass', 10);
    db.data.settings.auth.passwordHash   = hash;
    db.data.settings.webdav.enabled      = true;
    db.data.settings.webdav.username     = 'testuser';
    db.data.settings.vaultPath           = tmpVault;
    await db.write();
  });

  after(() => {
    fs.rmSync(tmpVault, { recursive: true, force: true });
  });

  test('GET /webdav sans auth → 401', async () => {
    const res = await request.get('/webdav/');
    assert.equal(res.status, 401);
    assert.ok(res.headers['www-authenticate']?.includes('Basic'));
  });

  test('GET /webdav avec mauvais password → 401', async () => {
    const creds = Buffer.from('testuser:mauvaispass').toString('base64');
    const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
    assert.equal(res.status, 401);
  });

  test('GET /webdav avec bons credentials → pas 401/503', async () => {
    const creds = Buffer.from('testuser:testpass').toString('base64');
    const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 503);
  });

  test('GET /webdav quand désactivé → 503', async () => {
    db.data.settings.webdav.enabled = false;
    await db.write();
    const creds = Buffer.from('testuser:testpass').toString('base64');
    const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
    assert.equal(res.status, 503);
    db.data.settings.webdav.enabled = true;
    await db.write();
  });
});
