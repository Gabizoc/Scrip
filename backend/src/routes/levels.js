import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const levelsRouter = Router();

levelsRouter.get('/', async (req, res) => {
  await db.read();
  res.json(db.data.levels);
});

levelsRouter.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  await db.read();
  const level = { id: randomUUID(), name: name.trim() };
  db.data.levels.push(level);
  await db.write();
  res.status(201).json(level);
});

levelsRouter.patch('/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'name requis' });
  }
  await db.read();
  const level = db.data.levels.find(l => l.id === req.params.id);
  if (!level) return res.status(404).json({ error: 'niveau introuvable' });
  level.name = name.trim();
  await db.write();
  res.json(level);
});

levelsRouter.delete('/:id', async (req, res) => {
  await db.read();
  const linked = db.data.subjects.some(s => s.levelId === req.params.id);
  if (linked) {
    return res.status(409).json({
      error: "Ce niveau contient des matières — supprimez-les d'abord",
    });
  }
  db.data.levels = db.data.levels.filter(l => l.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
