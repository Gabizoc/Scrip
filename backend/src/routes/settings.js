// backend/src/routes/settings.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

export const settingsRouter = Router();

/** Retire passwordHash de l'objet settings avant de l'envoyer au client.
 *  Expose `hasPassword` (boolean) à la place pour que le frontend
 *  puisse adapter son libellé sans jamais recevoir le hash. */
function sanitize(settings) {
  const { webdav: { passwordHash, ...webdavPublic } = {}, ...rest } = settings;
  return { ...rest, webdav: { ...webdavPublic, hasPassword: passwordHash !== null } };
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

  if (req.body.webdav) {
    const { enabled, username, password } = req.body.webdav;
    if (enabled !== undefined) db.data.settings.webdav.enabled = Boolean(enabled);
    if (username !== undefined) db.data.settings.webdav.username = String(username).trim();
    if (password) {
      db.data.settings.webdav.passwordHash = await bcrypt.hash(String(password), 10);
    }
  }

  await db.write();
  res.json(sanitize(db.data.settings));
});
