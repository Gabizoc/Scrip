// backend/src/routes/settings.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

export const settingsRouter = Router();

/** Retire passwordHash de settings avant d'envoyer au client.
 *  Expose hasPassword (bool) et hasSetup (bool) à la place. */
function sanitize(settings) {
  const { auth: { passwordHash, pendingSetupToken, pendingResetToken, pendingMagicToken, ...authPublic } = {}, ...rest } = settings;
  const { webdav: { passwordHash: wHash, ...webdavPublic } = {} } = rest;
  return {
    ...rest,
    auth:  { ...authPublic, hasPassword: passwordHash !== null },
    webdav: { ...webdavPublic, hasPassword: wHash !== null },
  };
}

settingsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(sanitize(db.data.settings));
});

settingsRouter.put('/', async (req, res) => {
  await db.read();

  const scalarFields = ['theme', 'vaultPath', 'currentLevelId', 'publicUrl'];
  for (const key of scalarFields) {
    if (req.body[key] !== undefined) db.data.settings[key] = req.body[key];
  }

  // Champs WebDAV (hors password)
  if (req.body.webdav) {
    const { enabled, username, password } = req.body.webdav;
    if (enabled !== undefined) db.data.settings.webdav.enabled = Boolean(enabled);
    if (username !== undefined) db.data.settings.webdav.username = String(username).trim();
    // Le password WebDAV est désormais géré via auth — si fourni, met à jour les deux
    if (password) {
      const hash = await bcrypt.hash(String(password), 10);
      db.data.settings.auth.passwordHash   = hash;
      db.data.settings.webdav.passwordHash = hash;
    }
  }

  await db.write();
  res.json(sanitize(db.data.settings));
});
