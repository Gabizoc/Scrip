// backend/src/db.js
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA = {
  settings: {
    theme: 'auto',
    vaultPath: path.join(__dirname, '../../vault'),
    currentLevelId: null,
    publicUrl: '',
    auth: {
      passwordHash:      null,
      pendingSetupToken: null,
      pendingResetToken: null,
      pendingMagicToken: null,
    },
    webdav: {
      enabled:      false,
      username:     'scrip',
      passwordHash: null,
    },
  },
  levels:   [],
  subjects: [],
  notes:    [],
};

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../data/db.json');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const adapter = new JSONFile(DB_PATH);
export const db = new Low(adapter, DEFAULT_DATA);

/**
 * Initialise la db : lit le fichier, fusionne avec les valeurs par défaut.
 * À appeler au démarrage du serveur.
 */
export async function initDb() {
  await db.read();

  const existing = db.data.settings ?? {};

  db.data = {
    settings: {
      ...DEFAULT_DATA.settings,
      ...existing,
      auth: {
        ...DEFAULT_DATA.settings.auth,
        ...(existing.auth ?? {}),
      },
      webdav: {
        ...DEFAULT_DATA.settings.webdav,
        ...(existing.webdav ?? {}),
      },
    },
    levels:   db.data.levels   ?? [],
    subjects: db.data.subjects ?? [],
    notes:    db.data.notes    ?? [],
  };

  // Migration : si auth.passwordHash est vide mais webdav.passwordHash existe,
  // copier pour que l'ancien mot de passe WebDAV devienne le mot de passe de l'app.
  if (!db.data.settings.auth.passwordHash && db.data.settings.webdav.passwordHash) {
    db.data.settings.auth.passwordHash = db.data.settings.webdav.passwordHash;
  }

  await db.write();
}
