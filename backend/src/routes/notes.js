// backend/src/routes/notes.js
import { Router } from 'express';
import fs from 'node:fs';
import { db } from '../db.js';

export const notesRouter = Router();

notesRouter.get('/', async (req, res) => {
  await db.read();
  const notes = [...db.data.notes].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(notes);
});

notesRouter.get('/:id', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  let markdown = '';
  if (note.path && fs.existsSync(note.path)) {
    markdown = fs.readFileSync(note.path, 'utf8');
  } else {
    return res.status(404).json({ error: 'fichier introuvable sur disque', note });
  }
  res.json({ ...note, markdown });
});

notesRouter.patch('/:id', async (req, res) => {
  const { markdown } = req.body;
  if (typeof markdown !== 'string') {
    return res.status(400).json({ error: 'markdown (string) requis' });
  }
  if (markdown.trim().length === 0) {
    return res.status(400).json({ error: 'markdown ne peut pas être vide' });
  }
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  fs.writeFileSync(note.path, markdown, 'utf8');
  note.updatedAt = new Date().toISOString();
  await db.write();
  res.json(note);
});

notesRouter.delete('/:id', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  if (fs.existsSync(note.path)) fs.unlinkSync(note.path);
  if (note.auditPath && fs.existsSync(note.auditPath)) {
    fs.unlinkSync(note.auditPath);
  }
  db.data.notes = db.data.notes.filter(n => n.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
