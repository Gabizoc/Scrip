import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export function resolveVaultPath(stored) {
  const v = (stored && String(stored).trim()) || 'vault';
  return path.isAbsolute(v) ? v : path.resolve(PROJECT_ROOT, v);
}

const DEFAULT_DATA = {
  settings: {
    theme: 'auto', vaultPath: 'vault', currentLevelId: null, publicUrl: '', trashRetentionDays: 30, auth: {
      passwordHash: null, pendingSetupToken: null, pendingResetToken: null, pendingMagicToken: null, }, webdav: {
      enabled: false, username: 'scrip', passwordHash: null, }, }, levels: [], subjects: [], notes: [], trash: [],
};

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../data/db.json');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const adapter = new JSONFile(DB_PATH);
export const db = new Low(adapter, DEFAULT_DATA);

export async function initDb() {
  await db.read();

  const existing = db.data.settings ?? {};

  db.data = {
    settings: {
      ...DEFAULT_DATA.settings, ...existing, auth: {
        ...DEFAULT_DATA.settings.auth, ...(existing.auth ?? {}), }, webdav: {
        ...DEFAULT_DATA.settings.webdav, ...(existing.webdav ?? {}), }, }, levels: db.data.levels   ?? [], subjects: db.data.subjects ?? [], notes: db.data.notes    ?? [], trash: db.data.trash    ?? [], };

  if (!db.data.settings.auth.passwordHash && db.data.settings.webdav.passwordHash) {
    db.data.settings.auth.passwordHash = db.data.settings.webdav.passwordHash;
  }

  await db.write();
}
