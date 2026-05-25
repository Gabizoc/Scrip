// backend/src/routes/auth.js
import { Router }   from 'express';
import bcrypt       from 'bcryptjs';
import crypto       from 'node:crypto';
import { db }       from '../db.js';
import { sendMail } from '../lib/mailer.js';

export const authRouter = Router();

/** Génère un token aléatoire de 32 octets (64 chars hex) */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Crée un objet token avec expiry 15 minutes */
function makeToken() {
  return { token: generateToken(), expiresAt: Date.now() + 15 * 60 * 1000 };
}

/** Vérifie qu'un objet token est valide (non nul, non expiré, token correct).
 *  Utilise timingSafeEqual pour éviter les timing attacks. */
function isValidToken(stored, incoming) {
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(String(incoming ?? '')),
    );
  } catch {
    return false;
  }
}

/** URL publique du serveur (env > db > localhost fallback) */
async function getBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  await db.read();
  return (db.data.settings.publicUrl ?? '').replace(/\/$/, '') || `http://localhost:${process.env.PORT ?? 5001}`;
}

// ── GET /api/auth/status ──────────────────────────────────────────────────────
authRouter.get('/status', async (req, res) => {
  await db.read();
  res.json({
    loggedIn:   req.session?.loggedIn === true,
    needsSetup: db.data.settings.auth.passwordHash === null,
  });
});

// ── POST /api/auth/setup-request ─────────────────────────────────────────────
authRouter.post('/setup-request', async (req, res) => {
  await db.read();
  if (db.data.settings.auth.passwordHash !== null) {
    return res.status(403).json({ error: 'Setup déjà effectué' });
  }

  // Éviter d'écraser un token valide non expiré
  const existing = db.data.settings.auth.pendingSetupToken;
  if (existing && Date.now() <= existing.expiresAt) {
    return res.status(429).json({ error: 'Lien déjà envoyé. Vérifiez votre boîte mail (expire dans 15 min).' });
  }

  const pending = makeToken();
  db.data.settings.auth.pendingSetupToken = pending;
  await db.write();

  const baseUrl = await getBaseUrl();
  const link    = `${baseUrl}/setup/password?token=${pending.token}`;

  try {
    await sendMail({
      to:      process.env.AUTH_EMAIL,
      subject: 'Scrip — Configuration initiale',
      html:    `<p>Cliquez sur le lien pour définir votre mot de passe :</p>
                <p><a href="${link}">${link}</a></p>
                <p>Ce lien expire dans 15 minutes.</p>`,
    });
  } catch (err) {
    console.error('[auth] Erreur envoi email setup:', err.message);
  }

  res.json({ ok: true });
});

// ── POST /api/auth/setup-complete ────────────────────────────────────────────
authRouter.post('/setup-complete', async (req, res) => {
  await db.read();
  if (db.data.settings.auth.passwordHash !== null) {
    return res.status(403).json({ error: 'Setup déjà effectué' });
  }

  const { token, password } = req.body ?? {};
  if (!token || !password) {
    return res.status(400).json({ error: 'token et password requis' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  }
  if (!isValidToken(db.data.settings.auth.pendingSetupToken, token)) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  db.data.settings.auth.passwordHash      = await bcrypt.hash(password, 10);
  db.data.settings.auth.pendingSetupToken = null;
  db.data.settings.webdav.passwordHash    = db.data.settings.auth.passwordHash;
  await db.write();

  req.session.loggedIn = true;
  res.json({ ok: true });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  await db.read();
  const { email, password } = req.body ?? {};

  const emailOk = typeof email === 'string'
    && email.toLowerCase() === process.env.AUTH_EMAIL.toLowerCase();

  const hash       = db.data.settings.auth.passwordHash;
  const passwordOk = hash ? await bcrypt.compare(String(password ?? ''), hash) : false;

  if (!emailOk || !passwordOk) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  req.session.loggedIn = true;
  res.json({ ok: true });
});

// ── POST /api/auth/magic ──────────────────────────────────────────────────────
authRouter.post('/magic', async (req, res) => {
  await db.read();
  if (db.data.settings.auth.passwordHash === null) {
    return res.status(403).json({ error: 'Setup non effectué' });
  }

  const pending = makeToken();
  db.data.settings.auth.pendingMagicToken = pending;
  await db.write();

  const baseUrl = await getBaseUrl();
  const link    = `${baseUrl}/api/auth/magic/${pending.token}`;

  try {
    await sendMail({
      to:      process.env.AUTH_EMAIL,
      subject: 'Scrip — Connexion par lien',
      html:    `<p>Cliquez sur le lien pour vous connecter :</p>
                <p><a href="${link}">${link}</a></p>
                <p>Ce lien expire dans 15 minutes.</p>`,
    });
  } catch (err) {
    console.error('[auth] Erreur envoi magic link:', err.message);
  }

  res.json({ ok: true });
});

// ── GET /api/auth/magic/:token ────────────────────────────────────────────────
authRouter.get('/magic/:token', async (req, res) => {
  await db.read();
  const { token } = req.params;

  if (!isValidToken(db.data.settings.auth.pendingMagicToken, token)) {
    return res.status(401).send('Lien invalide ou expiré. <a href="/login">Réessayer</a>');
  }

  db.data.settings.auth.pendingMagicToken = null;
  await db.write();

  req.session.loggedIn = true;
  res.redirect('/');
});

// ── POST /api/auth/forgot ─────────────────────────────────────────────────────
authRouter.post('/forgot', async (req, res) => {
  await db.read();
  if (db.data.settings.auth.passwordHash === null) {
    return res.status(403).json({ error: 'Setup non effectué' });
  }

  const pending = makeToken();
  db.data.settings.auth.pendingResetToken = pending;
  await db.write();

  const baseUrl = await getBaseUrl();
  const link    = `${baseUrl}/reset/${pending.token}`;

  try {
    await sendMail({
      to:      process.env.AUTH_EMAIL,
      subject: 'Scrip — Réinitialisation du mot de passe',
      html:    `<p>Cliquez sur le lien pour réinitialiser votre mot de passe :</p>
                <p><a href="${link}">${link}</a></p>
                <p>Ce lien expire dans 15 minutes.</p>`,
    });
  } catch (err) {
    console.error('[auth] Erreur envoi reset:', err.message);
  }

  res.json({ ok: true });
});

// ── POST /api/auth/reset ──────────────────────────────────────────────────────
authRouter.post('/reset', async (req, res) => {
  await db.read();
  const { token, password } = req.body ?? {};

  if (!token || !password) {
    return res.status(400).json({ error: 'token et password requis' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  }
  if (!isValidToken(db.data.settings.auth.pendingResetToken, token)) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  db.data.settings.auth.passwordHash      = await bcrypt.hash(password, 10);
  db.data.settings.auth.pendingResetToken = null;
  db.data.settings.webdav.passwordHash    = db.data.settings.auth.passwordHash;
  await db.write();

  // Auto-login après reset — l'utilisateur vient de prouver l'accès à sa boîte mail
  req.session.loggedIn = true;
  res.json({ ok: true });
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
// Route protégée — nécessite une session active
authRouter.post('/change-password', async (req, res) => {
  if (req.session?.loggedIn !== true) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  await db.read();
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword et newPassword requis' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Nouveau mot de passe trop court (8 caractères minimum)' });
  }

  const hash = db.data.settings.auth.passwordHash;
  if (!hash) {
    return res.status(403).json({ error: 'Aucun mot de passe défini' });
  }
  const ok = await bcrypt.compare(String(currentPassword), hash);
  if (!ok) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.data.settings.auth.passwordHash   = newHash;
  db.data.settings.webdav.passwordHash = newHash;
  await db.write();

  res.json({ ok: true });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});
