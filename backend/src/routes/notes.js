// backend/src/routes/notes.js
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export const notesRouter = Router();

notesRouter.get('/', async (req, res) => {
  await db.read();
  const notes = [...db.data.notes]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(note => ({
      ...note,
      subject: db.data.subjects.find(s => s.id === note.subjectId)?.name ?? note.subjectId,
      level:   db.data.levels.find(l => l.id === note.levelId)?.name   ?? note.levelId,
    }));
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
  // Enrichir avec les noms lisibles (matière + niveau)
  const subject = db.data.subjects.find(s => s.id === note.subjectId);
  const level   = db.data.levels.find(l => l.id === note.levelId);
  res.json({
    ...note,
    markdown,
    note: {
      ...note,
      subject: subject?.name ?? note.subjectId,
      level:   level?.name   ?? note.levelId,
    },
  });
});

notesRouter.patch('/:id', async (req, res) => {
  const { markdown, subject, title } = req.body;
  if (markdown === undefined && subject === undefined && title === undefined) {
    return res.status(400).json({ error: 'markdown, subject ou title requis' });
  }

  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });

  // Mise à jour du markdown
  if (typeof markdown === 'string') {
    if (markdown.trim().length === 0) return res.status(400).json({ error: 'markdown ne peut pas être vide' });
    fs.writeFileSync(note.path, markdown, 'utf8');
  }

  // Mise à jour du titre
  if (typeof title === 'string' && title.trim().length > 0) {
    note.title = title.trim();
  }

  // Mise à jour de la matière (trouve ou crée)
  if (typeof subject === 'string' && subject.trim().length > 0) {
    const name = subject.trim();
    let sub = db.data.subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!sub) {
      sub = { id: randomUUID(), name };
      db.data.subjects.push(sub);
    }
    note.subjectId = sub.id;
  }

  note.updatedAt = new Date().toISOString();
  await db.write();
  res.json({
    ...note,
    subject: db.data.subjects.find(s => s.id === note.subjectId)?.name ?? note.subjectId,
  });
});

// GET /notes/:id/sources — liste les photos originales
notesRouter.get('/:id/sources', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  const sources = (note.sourcePaths ?? [])
    .filter(p => fs.existsSync(p))
    .map((p, i) => ({ index: i, filename: path.basename(p), url: `/api/notes/${note.id}/sources/${path.basename(p)}` }));
  res.json(sources);
});

// GET /notes/:id/sources/:filename — sert le fichier image
notesRouter.get('/:id/sources/:filename', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  const filePath = (note.sourcePaths ?? []).find(p => path.basename(p) === req.params.filename);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'fichier introuvable' });
  res.sendFile(filePath);
});

notesRouter.delete('/:id', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  if (fs.existsSync(note.path)) fs.unlinkSync(note.path);
  if (note.auditPath && fs.existsSync(note.auditPath)) {
    fs.unlinkSync(note.auditPath);
  }
  // Supprime le dossier photos sources s'il existe
  if (note.sourcePaths?.length) {
    const sourcesDir = path.dirname(note.sourcePaths[0]);
    if (fs.existsSync(sourcesDir)) fs.rmSync(sourcesDir, { recursive: true, force: true });
  }
  db.data.notes = db.data.notes.filter(n => n.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
