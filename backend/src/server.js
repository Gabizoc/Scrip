import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../..', '.env') });

const REQUIRED_ENV = ['SESSION_SECRET', 'AUTH_EMAIL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[scrip] Variables d'environnement manquantes : ${missing.join(', ')}`);
  console.error('[scrip] Remplissez ces variables dans le fichier .env à la racine du projet.');
  process.exit(1);
}

const { createApp } = await import('./app.js');
const { initDb } = await import('./db.js');
const { purgeExpiredTrash } = await import('./trash.js');

const PORT = process.env.PORT ?? 5001;

await initDb();

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
