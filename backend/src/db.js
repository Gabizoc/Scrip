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
  },
  levels: [],
  subjects: [],
  notes: [],
};

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../data/db.json');

// Créer le dossier data/ si nécessaire
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const adapter = new JSONFile(DB_PATH);
export const db = new Low(adapter, DEFAULT_DATA);

/**
 * Initialise la db : lit le fichier, fusionne avec les valeurs par défaut.
 * À appeler au démarrage du serveur.
 */
export async function initDb() {
  await db.read();
  db.data = {
    settings: { ...DEFAULT_DATA.settings, ...db.data.settings },
    levels:   db.data.levels   ?? [],
    subjects: db.data.subjects ?? [],
    notes:    db.data.notes    ?? [],
  };
  await db.write();
}
