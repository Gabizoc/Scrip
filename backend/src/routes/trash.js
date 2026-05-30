import { Router } from 'express';
import { db } from '../db.js';
import { restoreTrashFiles, deleteTrashFiles } from '../trash.js';

export const trashRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

trashRouter.get('/', async (req, res) => {
  await db.read();
  const days = Number(db.data.settings.trashRetentionDays ?? 30);
  const entries = (db.data.trash ?? [])
    .slice()
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
    .map(e => {
      const n = e.note ?? {};
      return {
        id:        e.id,
        title:     n.title ?? '(sans titre)',
        subject:   db.data.subjects.find(s => s.id === n.subjectId)?.name ?? n.subjectId ?? null,
        level:     db.data.levels.find(l => l.id === n.levelId)?.name   ?? n.levelId   ?? null,
        deletedAt: e.deletedAt,
        expiresAt: new Date(new Date(e.deletedAt).getTime() + days * DAY_MS).toISOString(),
      };
    });
  res.json(entries);
});

trashRouter.post('/:id/restore', async (req, res) => {
  await db.read();
  const idx = (db.data.trash ?? []).findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'entrée corbeille introuvable' });

  const entry = db.data.trash[idx];
  try {
    restoreTrashFiles(entry);
  } catch (err) {
    return res.status(409).json({ error: err.message });
  }

  db.data.notes.push(entry.note);
  db.data.trash.splice(idx, 1);
  await db.write();
  res.json({ restored: entry.id });
});

trashRouter.delete('/', async (req, res) => {
  await db.read();
  for (const entry of (db.data.trash ?? [])) deleteTrashFiles(entry);
  db.data.trash = [];
  await db.write();
  res.status(204).end();
});

trashRouter.delete('/:id', async (req, res) => {
  await db.read();
  const idx = (db.data.trash ?? []).findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'entrée corbeille introuvable' });

  deleteTrashFiles(db.data.trash[idx]);
  db.data.trash.splice(idx, 1);
  await db.write();
  res.status(204).end();
});
