import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { parse, z } from '../lib/validate.js';
import { sanitizeRelPath } from '../lib/paths.js';

export const settingsRouter = Router();

function sanitize(settings) {
  const { auth: { passwordHash, pendingSetupToken: _s, pendingResetToken: _r, pendingMagicToken: _m, ...authPublic } = {}, ...rest } = settings;
  const { webdav: { passwordHash: wHash, ...webdavPublic } = {} } = rest;
  return {
    ...rest,
    auth:  { ...authPublic, hasPassword: passwordHash !== null },
    // hasPassword : un mot de passe WebDAV dédié existe (sinon celui de l'app est utilisé).
    webdav: { ...webdavPublic, hasPassword: wHash != null },
  };
}

const settingsSchema = z.object({
  theme:              z.enum(['auto', 'light', 'dark']).optional(),
  vaultPath:          z.string().trim().max(500).optional(),
  syncFolder:         z.string().max(300).optional(),
  currentLevelId:     z.string().nullable().optional(),
  publicUrl:          z.union([z.literal(''), z.url()]).optional(),
  trashRetentionDays: z.coerce.number().int().positive().max(3650).optional(),
  webdav: z.object({
    enabled:  z.boolean().optional(),
    username: z.string().trim().min(1, 'identifiant requis').max(100).optional(),
    password: z.string().min(8, 'Mot de passe WebDAV trop court (8 caractères minimum)').max(200).optional(),
    // true : supprime le mot de passe dédié et revient à celui de l'application.
    useAppPassword: z.boolean().optional(),
  }).optional(),
});

settingsRouter.get('/', (req, res) => {
  res.json(sanitize(db.data.settings));
});

settingsRouter.put('/', async (req, res) => {
  const body = parse(settingsSchema, req.body);
  const settings = db.data.settings;

  for (const key of ['theme', 'vaultPath', 'currentLevelId', 'publicUrl', 'trashRetentionDays']) {
    if (body[key] !== undefined) settings[key] = body[key];
  }
  if (body.syncFolder !== undefined) settings.syncFolder = sanitizeRelPath(body.syncFolder).join('/');

  if (body.webdav) {
    const { enabled, username, password, useAppPassword } = body.webdav;
    if (enabled !== undefined) settings.webdav.enabled = enabled;
    if (username !== undefined) settings.webdav.username = username;
    if (useAppPassword) settings.webdav.passwordHash = null;
    else if (password) settings.webdav.passwordHash = await bcrypt.hash(password, 10);
  }

  await db.write();
  res.json(sanitize(settings));
});
