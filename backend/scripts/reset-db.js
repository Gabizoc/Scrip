import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '../data/db.json');

// Les valeurs par défaut manquantes (auth, webdav…) sont complétées par initDb() au démarrage.
const DEFAULT_DATA = {
  settings: {
    theme: 'auto',
    vaultPath: 'vault',
    currentLevelId: null,
  },
  levels: [],
  subjects: [],
  notes: [],
  trash: [],
  jobs: [],
};

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8');

console.log('✓ DB réinitialisée :', DB_PATH);
console.log('  vaultPath → vault (relatif à la racine du projet)');
