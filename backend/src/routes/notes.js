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

// GET /notes/search?q=xxx — recherche full-text dans les titres et le contenu markdown
notesRouter.get('/search', async (req, res) => {
  const q = (req.query.q ?? '').toLowerCase().trim();
  if (q.length < 2) return res.json([]);

  await db.read();
  const results = [];

  for (const note of db.data.notes) {
    const subject = db.data.subjects.find(s => s.id === note.subjectId);
    const level   = db.data.levels.find(l => l.id === note.levelId);
    const enriched = {
      ...note,
      subject: subject?.name ?? note.subjectId,
      level:   level?.name   ?? note.levelId,
    };

    // Cherche d'abord dans le titre (pas besoin de lire le fichier)
    if (note.title?.toLowerCase().includes(q)) {
      results.push({ ...enriched, snippet: null });
      continue;
    }

    // Cherche dans le contenu markdown
    if (!note.path || !fs.existsSync(note.path)) continue;
    let raw;
    try { raw = fs.readFileSync(note.path, 'utf8'); } catch { continue; }

    const lower = raw.toLowerCase();
    const idx   = lower.indexOf(q);
    if (idx === -1) continue;

    // Extrait un extrait de 90 chars centré sur le match
    const start   = Math.max(0, idx - 40);
    const end     = Math.min(raw.length, idx + q.length + 50);
    const snippet =
      (start > 0 ? '…' : '') +
      raw.slice(start, end).replace(/[#*`\n]/g, ' ').replace(/\s+/g, ' ').trim() +
      (end < raw.length ? '…' : '');

    results.push({ ...enriched, snippet });
  }

  // Titres en premier (snippet null), puis contenu ; max 50 résultats
  results.sort((a, b) => (a.snippet === null ? -1 : b.snippet === null ? 1 : 0));
  res.json(results.slice(0, 50));
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
  const { markdown, subject, title, subjectId, subfolder } = req.body;
  if (
    markdown === undefined && subject === undefined && title === undefined &&
    subjectId === undefined && subfolder === undefined
  ) {
    return res.status(400).json({ error: 'markdown, subject, title, subjectId ou subfolder requis' });
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

  // Mise à jour de la matière par ID direct
  if (typeof subjectId === 'string' && subjectId.trim().length > 0) {
    const sub = db.data.subjects.find(s => s.id === subjectId);
    if (!sub) return res.status(400).json({ error: 'matière introuvable' });
    note.subjectId = sub.id;
  }

  // Mise à jour du sous-dossier (chaîne vide = suppression)
  if (subfolder !== undefined) {
    const sf = String(subfolder).trim();
    if (sf) {
      note.subfolder = sf;
    } else {
      delete note.subfolder;
    }
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
