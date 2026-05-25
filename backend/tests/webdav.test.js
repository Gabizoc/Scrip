// backend/tests/webdav.test.js
import { test, before, after } from 'node:test';
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

test('GET /api/settings ne renvoie pas passwordHash', async () => {
  const res = await request.get('/api/settings');
  assert.equal(res.status, 200);
  assert.ok('webdav' in res.body, 'webdav doit être présent');
  assert.ok(!('passwordHash' in res.body.webdav), 'passwordHash ne doit pas être exposé');
  assert.equal(res.body.webdav.enabled, false);
  assert.equal(res.body.webdav.username, 'scrip');
});

test('PUT /api/settings webdav.password est haché et non renvoyé', async () => {
  const res = await request.put('/api/settings').send({
    webdav: { enabled: true, username: 'gabi', password: 'monmotdepasse' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.webdav.enabled, true);
  assert.equal(res.body.webdav.username, 'gabi');
  assert.ok(!('passwordHash' in res.body.webdav));
  assert.ok(!('password' in res.body.webdav));
});

test('PUT /api/settings publicUrl est accepté', async () => {
  const res = await request.put('/api/settings').send({
    publicUrl: 'https://scrip.example.com',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.publicUrl, 'https://scrip.example.com');
});
