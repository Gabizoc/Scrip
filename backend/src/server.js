// backend/src/server.js
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Charge .env depuis la racine du repo, peu importe le CWD
// IMPORTANT : doit être fait avant tout import qui lit process.env au niveau module
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../..', '.env') });

// Validation des variables d'environnement obligatoires
const REQUIRED_ENV = ['SESSION_SECRET', 'AUTH_EMAIL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[scrip] Variables d'environnement manquantes : ${missing.join(', ')}`);
  console.error('[scrip] Remplissez ces variables dans le fichier .env à la racine du projet.');
  process.exit(1);
}

// Imports dynamiques — garantit que .env est chargé avant que les modules lisent process.env
const { createApp } = await import('./app.js');
const { initDb } = await import('./db.js');
const { purgeExpiredTrash } = await import('./trash.js');

const PORT = process.env.PORT ?? 5001;

await initDb();

// Purge de la corbeille : au démarrage puis toutes les 12h
async function runPurge() {
  try {
    const n = await purgeExpiredTrash();
    if (n > 0) console.log(`[scrip] corbeille : ${n} note(s) purgée(s) définitivement`);
  } catch (err) {
    console.error(`[scrip] erreur purge corbeille (ignorée) : ${err.message}`);
  }
}
await runPurge();
setInterval(runPurge, 12 * 60 * 60 * 1000).unref();

const app = createApp();
app.listen(PORT, () => {
  console.log(`[scrip-backend] http://localhost:${PORT}`);
});
