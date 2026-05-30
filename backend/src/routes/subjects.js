import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, resolveVaultPath } from '../db.js';

export const subjectsRouter = Router();

subjectsRouter.get('/', async (req, res) => {
  await db.read();
  let subjects = db.data.subjects;
  if (req.query.levelId) {
    subjects = subjects.filter(s => s.levelId === req.query.levelId);
  }
  res.json(subjects);
});

subjectsRouter.post('/', async (req, res) => {
  const { name, levelId, prompt, outputFolder, emoji, color } = req.body;
  if (!name?.trim() || !levelId || !prompt || !outputFolder) {
    return res.status(400).json({ error: 'name, levelId, prompt et outputFolder requis' });
  }
  await db.read();
  if (!db.data.levels.some(l => l.id === levelId)) {
    return res.status(400).json({ error: 'niveau introuvable' });
  }
  const subject = { id: randomUUID(), name: name.trim(), levelId, prompt, outputFolder, ...(emoji ? { emoji } : {}), ...(color ? { color } : {}) };
  db.data.subjects.push(subject);
  await db.write();
  res.status(201).json(subject);
});

subjectsRouter.patch('/:id', async (req, res) => {
  await db.read();
  const subject = db.data.subjects.find(s => s.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'matière introuvable' });
  for (const key of ['name', 'prompt', 'outputFolder', 'emoji', 'color']) {
    if (req.body[key] !== undefined) subject[key] = req.body[key];
  }
  await db.write();
  res.json(subject);
});

subjectsRouter.get('/:id/folders', async (req, res) => {
  await db.read();
  const subject = db.data.subjects.find(s => s.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'matière introuvable' });

  const level    = db.data.levels.find(l => l.id === subject.levelId);
  if (!db.data.settings?.vaultPath || !level) return res.json([]);
  const vault    = resolveVaultPath(db.data.settings.vaultPath);
  const base     = path.resolve(vault, level.name, subject.outputFolder);

  if (!base.startsWith(path.resolve(vault) + path.sep) && base !== path.resolve(vault)) {
    return res.json([]);
  }

  const folders = [];

  function walk(dir, prefix = '') {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      folders.push(rel);
      walk(path.join(dir, e.name), rel);
    }
  }

  walk(base);
  res.json(folders.sort());
});

subjectsRouter.delete('/:id', async (req, res) => {
  await db.read();
  const linked = db.data.notes.some(n => n.subjectId === req.params.id);
  if (linked) {
    return res.status(409).json({
      error: "Cette matière contient des notes — supprimez-les d'abord",
    });
  }
  db.data.subjects = db.data.subjects.filter(s => s.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
