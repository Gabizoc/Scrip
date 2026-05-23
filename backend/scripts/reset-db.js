// backend/scripts/reset-db.js
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../data/db.json');
const VAULT_PATH = path.join(__dirname, '../../vault');

const DEFAULT_DATA = {
  settings: {
    theme: 'auto',
    vaultPath: VAULT_PATH,
    currentLevelId: null,
  },
  levels: [],
  subjects: [],
  notes: [],
};

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');

console.log('✓ DB réinitialisée :', DB_PATH);
console.log('  vaultPath →', VAULT_PATH);
