import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../..', '.env') });

if (!process.env.SESSION_SECRET) {
  console.error('[scrip] Variable SESSION_SECRET manquante. Remplissez-la dans votre .env.');
  process.exit(1);
}

const hasPassword = !!process.env.AUTH_PASSWORD;
const hasSMTP     = !!(process.env.AUTH_EMAIL || process.env.SMTP_HOST);

if (hasPassword && hasSMTP) {
  console.error('[scrip] Conflit : AUTH_PASSWORD et SMTP/AUTH_EMAIL sont tous les deux configures.');
  console.error('[scrip] Choisissez un seul mode : AUTH_PASSWORD (simple) ou AUTH_EMAIL + SMTP_* (magic link).');
  process.exit(1);
}

if (!hasPassword && !hasSMTP) {
  console.error('[scrip] Aucun mode d\'authentification configure.');
  console.error('[scrip] Definissez soit AUTH_PASSWORD, soit AUTH_EMAIL + SMTP_* dans votre .env.');
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
