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
