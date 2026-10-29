import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { parse, z, nonEmpty } from '../lib/validate.js';
import { sanitizeSegment } from '../lib/paths.js';

export const levelsRouter = Router();

// Le nom sert de dossier dans le vault : on le nettoie dès la saisie.
const levelSchema = z.object({
  name: nonEmpty('name').pipe(z.string().max(100)).transform(sanitizeSegment).refine(v => v.length > 0, 'nom invalide'),
});

levelsRouter.get('/', (req, res) => {
  res.json(db.data.levels);
});

levelsRouter.post('/', async (req, res) => {
  const { name } = parse(levelSchema, req.body);
  const level = { id: randomUUID(), name };
  db.data.levels.push(level);
  await db.write();
  res.status(201).json(level);
});

levelsRouter.patch('/:id', async (req, res) => {
  const { name } = parse(levelSchema, req.body);
  const level = db.data.levels.find(l => l.id === req.params.id);
  if (!level) return res.status(404).json({ error: 'niveau introuvable' });
  level.name = name;
  await db.write();
  res.json(level);
});

levelsRouter.delete('/:id', async (req, res) => {
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
