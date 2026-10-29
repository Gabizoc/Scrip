import { Router } from 'express';
import bcrypt      from 'bcryptjs';
import crypto      from 'node:crypto';
import { db }      from '../db.js';
import { log }     from '../lib/logger.js';
import { parse, z } from '../lib/validate.js';
import { SESSION_COOKIE } from '../session-store.js';

export const authRouter = Router();

const MODE = process.env.AUTH_PASSWORD ? 'password' : 'smtp';

const newPassword = z.string({ error: 'mot de passe requis' }).min(8, 'Mot de passe trop court (8 caractères minimum)').max(200);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
function makeToken() {
  return { token: generateToken(), expiresAt: Date.now() + 15 * 60 * 1000 };
}
function isValidToken(stored, incoming) {
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored.token), Buffer.from(String(incoming ?? '')));
  } catch { return false; }
}
function getBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  return (db.data.settings.publicUrl ?? '').replace(/\/$/, '') || `http://localhost:${process.env.PORT ?? 7001}`;
}

// Nouvelle session à chaque connexion (évite la fixation de session).
function startSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) return reject(err);
      req.session.loggedIn = true;
      req.session.save(err2 => (err2 ? reject(err2) : resolve()));
    });
  });
}

async function sendLink(subject, intro, link) {
  try {
    const { sendMail } = await import('../lib/mailer.js');
    await sendMail({ to: process.env.AUTH_EMAIL, subject, html: `<p>${intro}</p><p><a href="${link}">${link}</a></p><p>Ce lien expire dans 15 minutes.</p>` });
  } catch (err) {
    log.error(`[auth] Erreur envoi email (${subject}) : ${err.message}`);
  }
}

async function setPassword(password) {
  db.data.settings.auth.passwordHash = await bcrypt.hash(password, 10);
}

async function ensurePasswordHash() {
  if (!process.env.AUTH_PASSWORD) return;
  const current = db.data.settings.auth.passwordHash;
  const matches = current ? await bcrypt.compare(process.env.AUTH_PASSWORD, current) : false;
  if (!matches) {
    await setPassword(process.env.AUTH_PASSWORD);
    await db.write();
  }
}

authRouter.get('/status', async (req, res) => {
  if (MODE === 'password') await ensurePasswordHash();
  res.json({
    loggedIn:   req.session?.loggedIn === true,
    needsSetup: db.data.settings.auth.passwordHash === null,
    authMode:   MODE,
  });
});

authRouter.post('/setup-request', async (req, res) => {
  if (db.data.settings.auth.passwordHash !== null) {
    return res.status(403).json({ error: 'Setup déjà effectué' });
  }
  const existing = db.data.settings.auth.pendingSetupToken;
  if (existing && Date.now() <= existing.expiresAt) {
    return res.status(429).json({ error: 'Lien déjà envoyé. Vérifiez votre boîte mail (expire dans 15 min).' });
  }
  const pending = makeToken();
  db.data.settings.auth.pendingSetupToken = pending;
  await db.write();
  await sendLink('Scrip - Configuration initiale', 'Cliquez sur le lien pour définir votre mot de passe :', `${getBaseUrl()}/setup/password?token=${pending.token}`);
  res.json({ ok: true });
});

authRouter.post('/setup-complete', async (req, res) => {
  if (db.data.settings.auth.passwordHash !== null) {
    return res.status(403).json({ error: 'Setup déjà effectué' });
  }
  const { token, password } = parse(z.object({ token: z.string().min(1, 'token requis'), password: newPassword }), req.body);
  if (!isValidToken(db.data.settings.auth.pendingSetupToken, token)) return res.status(401).json({ error: 'Token invalide ou expiré' });
  await setPassword(password);
  db.data.settings.auth.pendingSetupToken = null;
  await db.write();
  await startSession(req);
  res.json({ ok: true });
});

authRouter.post('/login', async (req, res) => {
  if (MODE === 'password') await ensurePasswordHash();
  const { email, password } = req.body ?? {};
  const hash = db.data.settings.auth.passwordHash;
  const passwordOk = hash ? await bcrypt.compare(String(password ?? ''), hash) : false;

  if (MODE === 'smtp') {
    const emailOk = typeof email === 'string'
      && email.toLowerCase() === process.env.AUTH_EMAIL.toLowerCase();
    if (!emailOk || !passwordOk) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  } else if (!passwordOk) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  await startSession(req);
  res.json({ ok: true });
});

authRouter.post('/magic', async (req, res) => {
  if (db.data.settings.auth.passwordHash === null) return res.status(403).json({ error: 'Setup non effectué' });
  const pending = makeToken();
  db.data.settings.auth.pendingMagicToken = pending;
  await db.write();
  await sendLink('Scrip - Connexion par lien', 'Cliquez sur le lien pour vous connecter :', `${getBaseUrl()}/api/auth/magic/${pending.token}`);
  res.json({ ok: true });
});

authRouter.get('/magic/:token', async (req, res) => {
  if (!isValidToken(db.data.settings.auth.pendingMagicToken, req.params.token)) {
    return res.status(401).send('Lien invalide ou expiré. <a href="/login">Réessayer</a>');
  }
  db.data.settings.auth.pendingMagicToken = null;
  await db.write();
  await startSession(req);
  res.redirect('/');
});

authRouter.post('/forgot', async (req, res) => {
  if (db.data.settings.auth.passwordHash === null) return res.status(403).json({ error: 'Setup non effectué' });
  const pending = makeToken();
  db.data.settings.auth.pendingResetToken = pending;
  await db.write();
  await sendLink('Scrip - Réinitialisation du mot de passe', 'Cliquez sur le lien pour réinitialiser votre mot de passe :', `${getBaseUrl()}/reset/${pending.token}`);
  res.json({ ok: true });
});

authRouter.post('/reset', async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(1, 'token requis'), password: newPassword }), req.body);
  if (!isValidToken(db.data.settings.auth.pendingResetToken, token)) return res.status(401).json({ error: 'Token invalide ou expiré' });
  await setPassword(password);
  db.data.settings.auth.pendingResetToken = null;
  await db.write();
  await startSession(req);
  res.json({ ok: true });
});

authRouter.post('/change-password', async (req, res) => {
  if (req.session?.loggedIn !== true) return res.status(401).json({ error: 'Non authentifié' });
  const { currentPassword, newPassword: next } = parse(z.object({
    currentPassword: z.string({ error: 'currentPassword requis' }).min(1, 'currentPassword requis'),
    newPassword,
  }), req.body);
  const hash = db.data.settings.auth.passwordHash;
  if (!hash) return res.status(403).json({ error: 'Aucun mot de passe défini' });
  const ok = await bcrypt.compare(currentPassword, hash);
  if (!ok) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  await setPassword(next);
  await db.write();
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });
});
