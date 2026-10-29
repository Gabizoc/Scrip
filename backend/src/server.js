import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../..', '.env') });

const { log } = await import('./lib/logger.js');

function fail(...lines) {
  for (const line of lines) log.fatal(`[scrip] ${line}`);
  process.exit(1);
}

const secret = process.env.SESSION_SECRET ?? '';
const secretHint = 'Générez-en une : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
if (secret.length < 16) {
  fail('Variable SESSION_SECRET manquante ou trop courte (16 caractères minimum).', secretHint);
}
// La valeur d'exemple est publique : n'importe qui pourrait forger un cookie de session.
if (secret.startsWith('change-to-')) {
  if (process.env.NODE_ENV === 'production') {
    fail('SESSION_SECRET est encore la valeur d\'exemple du .env.example.', secretHint);
  }
  log.warn(`[scrip] SESSION_SECRET est encore la valeur d'exemple — à changer avant toute mise en ligne. ${secretHint}`);
}

const hasPassword = !!process.env.AUTH_PASSWORD;
const hasSMTP     = !!(process.env.AUTH_EMAIL || process.env.SMTP_HOST);

if (hasPassword && hasSMTP) {
  fail('Conflit : AUTH_PASSWORD et SMTP/AUTH_EMAIL sont tous les deux configures.',
    'Choisissez un seul mode : AUTH_PASSWORD (simple) ou AUTH_EMAIL + SMTP_* (magic link).');
}

if (!hasPassword && !hasSMTP) {
  fail('Aucun mode d\'authentification configure.',
    'Definissez soit AUTH_PASSWORD, soit AUTH_EMAIL + SMTP_* dans votre .env.');
}

const { createApp } = await import('./app.js');
const { initDb } = await import('./db.js');
const { purgeExpiredTrash } = await import('./trash.js');
const { resumeJobs } = await import('./jobs.js');
const { checkPipelineConfig } = await import('./pipeline/providers.js');

const PORT = process.env.PORT ?? 7001;

await initDb();

const pipelineError = checkPipelineConfig();
if (pipelineError) log.warn(`[scrip] ${pipelineError} — l'ingestion de photos sera refusée.`);

async function runPurge() {
  try {
    const n = await purgeExpiredTrash();
    if (n > 0) log.info(`[scrip] corbeille : ${n} note(s) purgée(s) définitivement`);
  } catch (err) {
    log.error(`[scrip] erreur purge corbeille (ignorée) : ${err.message}`);
  }
}
await runPurge();
setInterval(runPurge, 12 * 60 * 60 * 1000).unref();

const app = createApp();
await resumeJobs();

app.listen(PORT, () => {
  log.info(`[scrip-backend] http://localhost:${PORT}`);
});
