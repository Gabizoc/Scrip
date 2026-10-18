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
      enabled: false, username: 'scrip', passwordHash: null, }, }, levels: [], subjects: [], notes: [], trash: [], jobs: [],
};

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../data/db.json');

export const DATA_DIR = path.dirname(DB_PATH);

fs.mkdirSync(DATA_DIR, { recursive: true });

// La base est chargée une seule fois au démarrage puis gardée en mémoire : les
// appels suivants à read() sont sans effet. Recharger le fichier à chaque requête
// écrasait les modifications d'une requête concurrente entre deux await.
class MemoryLow extends Low {
  #loaded = false;

  async read() {
    if (this.#loaded) return;
    await super.read();
    this.#loaded = true;
  }
}

const adapter = new JSONFile(DB_PATH);
export const db = new MemoryLow(adapter, DEFAULT_DATA);

export async function initDb() {
  await db.read();

  const existing = db.data.settings ?? {};

  db.data = {
    settings: {
      ...DEFAULT_DATA.settings, ...existing, auth: {
        ...DEFAULT_DATA.settings.auth, ...(existing.auth ?? {}), }, webdav: {
        ...DEFAULT_DATA.settings.webdav, ...(existing.webdav ?? {}), }, }, levels: db.data.levels   ?? [], subjects: db.data.subjects ?? [], notes: db.data.notes    ?? [], trash: db.data.trash    ?? [], jobs: db.data.jobs     ?? [], };

  const { auth, webdav } = db.data.settings;
  if (!auth.passwordHash && webdav.passwordHash) {
    auth.passwordHash = webdav.passwordHash;
  }
  // Anciennes versions : le hash WebDAV était une copie de celui de l'app. null = « utiliser
  // le mot de passe de l'app » ; un hash distinct n'existe que s'il a été défini explicitement.
  if (webdav.passwordHash && webdav.passwordHash === auth.passwordHash) {
    webdav.passwordHash = null;
  }

  await db.write();
}
