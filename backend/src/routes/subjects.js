import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, resolveVaultPath } from '../db.js';
import { parse, z, nonEmpty } from '../lib/validate.js';
import { sanitizeRelPath, safeJoin, noteFolderSegments } from '../lib/paths.js';

export const subjectsRouter = Router();

const folder = z.string().max(200).transform(v => sanitizeRelPath(v).join('/')).refine(v => v.length > 0, 'dossier de sortie invalide');

const subjectFields = {
  name:         nonEmpty('name').pipe(z.string().max(100)),
  prompt:       nonEmpty('prompt').pipe(z.string().max(100)),
  outputFolder: folder,
  // Emoji ou petite image en data URL (icône personnalisée, 48 px).
  emoji:        z.string().max(100_000).nullish(),
  color:        z.string().max(32).nullish(),
  // Termes propres à la matière, rappelés au modèle pour déchiffrer l'écriture.
  vocabulary:   z.string().max(5000).nullish(),
  // Corrections apprises (cf. lib/corrections.js) ; modifiables pour en retirer.
  corrections:  z.array(z.object({
    from:  z.string().min(1).max(100),
    to:    z.string().min(1).max(100),
    count: z.number().int().min(1),
  })).max(200).optional(),
};

const createSchema = z.object({ ...subjectFields, levelId: nonEmpty('levelId') });
const patchSchema = z.object(subjectFields).partial();

subjectsRouter.get('/', (req, res) => {
  let subjects = db.data.subjects;
  if (req.query.levelId) {
    subjects = subjects.filter(s => s.levelId === req.query.levelId);
  }
  res.json(subjects);
});

subjectsRouter.post('/', async (req, res) => {
  const { name, levelId, prompt, outputFolder, emoji, color, vocabulary } = parse(createSchema, req.body);
  if (!db.data.levels.some(l => l.id === levelId)) {
    return res.status(400).json({ error: 'niveau introuvable' });
  }
  const subject = { id: randomUUID(), name, levelId, prompt, outputFolder, ...(emoji ? { emoji } : {}), ...(color ? { color } : {}), ...(vocabulary?.trim() ? { vocabulary: vocabulary.trim() } : {}) };
  db.data.subjects.push(subject);
  await db.write();
  res.status(201).json(subject);
});

subjectsRouter.patch('/:id', async (req, res) => {
  const body = parse(patchSchema, req.body);
  const subject = db.data.subjects.find(s => s.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'matière introuvable' });
  for (const key of ['name', 'prompt', 'outputFolder', 'emoji', 'color', 'vocabulary', 'corrections']) {
    if (body[key] !== undefined) subject[key] = body[key];
  }
  await db.write();
  res.json(subject);
});

subjectsRouter.get('/:id/folders', async (req, res) => {
  const subject = db.data.subjects.find(s => s.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'matière introuvable' });

  const level = db.data.levels.find(l => l.id === subject.levelId);
  if (!level) return res.json([]);
  const vault = resolveVaultPath(db.data.settings.vaultPath);
  const base = safeJoin(vault, ...noteFolderSegments(db.data.settings, level, subject));

  const folders = [];

  async function walk(dir, prefix = '') {
    let entries;
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      folders.push(rel);
      await walk(path.join(dir, e.name), rel);
    }
  }

  await walk(base);
  res.json(folders.sort());
});

subjectsRouter.delete('/:id', async (req, res) => {
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
