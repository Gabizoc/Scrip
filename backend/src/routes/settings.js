// backend/src/routes/settings.js
import { Router } from 'express';
import { db } from '../db.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.settings);
});

settingsRouter.put('/', async (req, res) => {
  await db.read();
  const allowed = ['theme', 'vaultPath', 'currentLevelId'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.data.settings[key] = req.body[key];
    }
  }
  await db.write();
  res.json(db.data.settings);
});
