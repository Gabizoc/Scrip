// backend/tests/webdav.test.js
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDb = path.join(os.tmpdir(), `scrip-webdav-test-${Date.now()}.json`);
process.env.DB_PATH = tmpDb;

const { initDb, db } = await import('../src/db.js');

before(async () => { await initDb(); });
after(() => { if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb); });

test('db.data.settings a webdav et publicUrl par défaut', async () => {
  assert.deepEqual(db.data.settings.webdav, {
    enabled: false,
    username: 'scrip',
    passwordHash: null,
  });
  assert.equal(db.data.settings.publicUrl, '');
});

const { default: supertest } = await import('supertest');
const { createApp } = await import('../src/app.js');

const request = supertest(createApp());

test('GET /api/settings ne renvoie pas passwordHash mais expose hasPassword', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 200);
  assert.ok('webdav' in res.body, 'webdav doit être présent');
  assert.ok(!('passwordHash' in res.body.webdav), 'passwordHash ne doit pas être exposé');
  assert.ok('hasPassword' in res.body.webdav, 'hasPassword doit être présent');
  assert.equal(res.body.webdav.hasPassword, false, 'aucun mot de passe défini au départ');
  assert.equal(res.body.webdav.enabled, false);
  assert.equal(res.body.webdav.username, 'scrip');
});

test('PUT /api/settings webdav.password est haché, non renvoyé, hasPassword=true', async () => {
  const res = await request.put('/api/settings').send({
    webdav: { enabled: true, username: 'gabi', password: 'monmotdepasse' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.webdav.enabled, true);
  assert.equal(res.body.webdav.username, 'gabi');
  assert.ok(!('passwordHash' in res.body.webdav));
  assert.ok(!('password' in res.body.webdav));
  assert.equal(res.body.webdav.hasPassword, true, 'hasPassword doit être true après définition du mdp');
});

test('PUT /api/settings publicUrl est accepté', async () => {
  const res = await request.put('/api/settings').send({
    publicUrl: 'https://scrip.example.com',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.publicUrl, 'https://scrip.example.com');
});

// Tests WebDAV auth — scoped in describe so before/after don't affect prior tests
describe('WebDAV auth middleware', () => {
  // S'assure que le vault tmp existe pour le serveur WebDAV
  const tmpVault = path.join(os.tmpdir(), `scrip-vault-${Date.now()}`);

  // Configure les settings : webdav activé, password connu
  before(async () => {
    fs.mkdirSync(tmpVault, { recursive: true });
    await request.put('/api/settings').send({
      webdav: { enabled: true, username: 'testuser', password: 'testpass' },
      vaultPath: tmpVault,
    });
  });

  after(async () => {
    await request.put('/api/settings').send({ webdav: { enabled: true } });
    fs.rmSync(tmpVault, { recursive: true, force: true });
  });;

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
    // Le serveur WebDAV répond 207 (PROPFIND) ou 200/301 selon le verbe
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 503);
  });

  test('GET /webdav quand désactivé → 503', async () => {
    await request.put('/api/settings').send({ webdav: { enabled: false } });
    const creds = Buffer.from('testuser:testpass').toString('base64');
    const res = await request.get('/webdav/').set('Authorization', `Basic ${creds}`);
    assert.equal(res.status, 503);
  });
});
