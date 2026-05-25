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
  console.error('[scrip] Copiez backend/.env.example vers .env et remplissez les valeurs.');
  process.exit(1);
}

// Imports dynamiques — garantit que .env est chargé avant que les modules lisent process.env
const { createApp } = await import('./app.js');
const { initDb } = await import('./db.js');

const PORT = process.env.PORT ?? 5001;

await initDb();
const app = createApp();
app.listen(PORT, () => {
  console.log(`[scrip-backend] http://localhost:${PORT}`);
});
