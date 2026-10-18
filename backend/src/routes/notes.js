import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, resolveVaultPath } from '../db.js';
import { buildTrashEntry } from '../trash.js';
import { parse, z } from '../lib/validate.js';
import { sanitizeRelPath, safeJoin, noteFolderSegments } from '../lib/paths.js';
import { extractCorrections, recordCorrections } from '../lib/corrections.js';

export const notesRouter = Router();

function publicNote(note) {
  const { path: _path, fileMtime: _ft, ...pub } = note;
  return pub;
}

function withNames(note) {
  return {
    ...publicNote(note),
    subject: db.data.subjects.find(s => s.id === note.subjectId)?.name ?? note.subjectId ?? null,
    level:   db.data.levels.find(l => l.id === note.levelId)?.name   ?? note.levelId   ?? null,
  };
}

function extractTitle(markdown) {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+)$/m);
    if (t) return t[1].trim().replace(/^["']|["']$/g, '');
  }
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : null;
}

function vaultSearchRoot(settings) {
  const base = resolveVaultPath(settings.vaultPath);
  const sub = sanitizeRelPath(settings.syncFolder);
  return sub.length ? path.join(base, ...sub) : base;
}

const SKIP_DIRS = new Set(['.obsidian', '_sources', '_audit', '_debug', '.git', '.trash']);

async function walkVault(dir, results = []) {
  let entries;
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return results; }
  await Promise.all(entries.map(async (e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) {
      await walkVault(full, results);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      results.push(full);
    }
  }));
  return results;
}

async function statOrNull(p) {
  try { return await fs.promises.stat(p); } catch { return null; }
}

function inferFromPath(filePath, searchRoot, levels, subjects) {
  const parts = path.relative(searchRoot, filePath).split(path.sep);
  const levelName   = parts.length > 1 ? parts[0] : null;
  const subjectName = parts.length > 2 ? parts[1] : null;
  const levelId   = levelName   ? (levels.find(l => l.name === levelName)?.id ?? null) : null;
  const subject   = subjectName
    ? subjects.find(s => (s.outputFolder ?? s.name) === subjectName && (!levelId || s.levelId === levelId))
      ?? subjects.find(s => s.name === subjectName)
    : null;
  return { levelId, subjectId: subject?.id ?? null };
}

// Synchronise la liste des notes avec le vault : suit les fichiers renommés/déplacés
// (retrouvés par titre), met à jour les titres modifiés dans Obsidian et importe les
// nouveaux fichiers .md.
notesRouter.get('/', async (req, res) => {
  let dirty = false;
  const { levels, subjects } = db.data;
  const searchRoot = vaultSearchRoot(db.data.settings);
  const allFiles = await walkVault(searchRoot);

  // Index titre → fichier, construit seulement si une note a disparu de son emplacement.
  let titleIndex = null;
  const findByTitle = async (title) => {
    if (!titleIndex) {
      titleIndex = new Map();
      for (const f of allFiles) {
        try {
          const t = extractTitle(await fs.promises.readFile(f, 'utf8'));
          if (t && !titleIndex.has(t)) titleIndex.set(t, f);
        } catch { }
      }
    }
    return titleIndex.get(title) ?? null;
  };

  const synced = [];
  for (let note of db.data.notes) {
    if (!note.path) { synced.push(note); continue; }

    let stat = await statOrNull(note.path);
    if (!stat) {
      const found = note.title ? await findByTitle(note.title) : null;
      if (!found) { dirty = true; continue; }
      note = { ...note, path: found };
      stat = await statOrNull(found);
      dirty = true;
    }

    if (stat && (!note.fileMtime || stat.mtimeMs > note.fileMtime)) {
      try {
        const newTitle = extractTitle(await fs.promises.readFile(note.path, 'utf8'));
        note = { ...note, fileMtime: stat.mtimeMs, ...(newTitle ? { title: newTitle } : {}) };
        dirty = true;
      } catch { }
    }
    synced.push(note);
  }

  const knownPaths = new Set(synced.map(n => n.path));
  for (const filePath of allFiles) {
    if (knownPaths.has(filePath)) continue;
    try {
      const [content, stat] = await Promise.all([fs.promises.readFile(filePath, 'utf8'), fs.promises.stat(filePath)]);
      const { levelId, subjectId } = inferFromPath(filePath, searchRoot, levels, subjects);
      synced.push({
        id: randomUUID(), title: extractTitle(content) || path.basename(filePath, '.md'), path: filePath, subjectId, levelId, createdAt: stat.mtime.toISOString(), fileMtime: stat.mtimeMs, source: 'vault-import', });
      dirty = true;
    } catch { }
  }

  if (dirty) {
    db.data.notes = synced;
    await db.write();
  }

  res.json(
    synced
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(withNames)
  );
});

notesRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase().trim();
  if (q.length < 2) return res.json([]);

  const results = await Promise.all(db.data.notes.map(async (note) => {
    if (note.title?.toLowerCase().includes(q)) return { ...withNames(note), snippet: null };
    if (!note.path) return null;

    let raw;
    try { raw = await fs.promises.readFile(note.path, 'utf8'); } catch { return null; }

    const idx = raw.toLowerCase().indexOf(q);
    if (idx === -1) return null;

    const start = Math.max(0, idx - 40);
    const end = Math.min(raw.length, idx + q.length + 50);
    const snippet =
      (start > 0 ? '…' : '') +
      raw.slice(start, end).replace(/[#*`\n]/g, ' ').replace(/\s+/g, ' ').trim() +
      (end < raw.length ? '…' : '');
    return { ...withNames(note), snippet };
  }));

  res.json(
    results
      .filter(Boolean)
      .sort((a, b) => (a.snippet === null ? -1 : b.snippet === null ? 1 : 0))
      .slice(0, 50)
  );
});

notesRouter.get('/:id', async (req, res) => {
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });

  let markdown;
  try {
    markdown = await fs.promises.readFile(note.path, 'utf8');
  } catch {
    return res.status(404).json({ error: 'fichier introuvable sur disque', note: publicNote(note) });
  }

  const freshTitle = extractTitle(markdown);
  if (freshTitle && freshTitle !== note.title) {
    note.title = freshTitle;
    await db.write();
  }

  res.json({ ...publicNote(note), markdown, note: withNames(note) });
});

const createSchema = z.object({
  title:     z.string({ error: 'titre requis' }).trim().min(1, 'titre requis').max(200),
  subjectId: z.string().nullish(),
  levelId:   z.string().nullish(),
  subfolder: z.string().max(300).nullish(),
  markdown:  z.string().max(2_000_000).nullish(),
});

notesRouter.post('/', async (req, res) => {
  const { title, subjectId, levelId, subfolder, markdown } = parse(createSchema, req.body);

  let subject = null;
  if (subjectId) {
    subject = db.data.subjects.find(s => s.id === subjectId);
    if (!subject) return res.status(400).json({ error: 'matière introuvable' });
  }

  const resolvedLevelId = levelId ?? subject?.levelId ?? db.data.settings.currentLevelId ?? null;
  const level = db.data.levels.find(l => l.id === resolvedLevelId) ?? null;

  const slug = title
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const id = randomUUID();
  const filename = `${slug || 'note'}-${id.slice(0, 8)}.md`;

  // Même emplacement que les notes ingérées : [syncFolder]/<niveau>/<matière>/<sous-dossier>.
  const vaultPath = resolveVaultPath(db.data.settings.vaultPath);
  const subfolderSegments = sanitizeRelPath(subfolder);
  const dir = safeJoin(vaultPath, ...noteFolderSegments(db.data.settings, level, subject), ...subfolderSegments);
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);

  const now = new Date();
  const content = markdown?.trim() || `# ${title}\n\n`;
  await fs.promises.writeFile(filePath, content, 'utf8');

  const note = {
    id, title, path: filePath, subjectId: subject?.id ?? null, levelId: level?.id ?? resolvedLevelId, createdAt: now.toISOString(), updatedAt: now.toISOString(), sourcePaths: [], metadata: {},
    ...(subfolderSegments.length ? { subfolder: subfolderSegments.join('/') } : {}),
  };

  db.data.notes.push(note);
  await db.write();

  res.status(201).json(withNames(note));
});

const patchSchema = z.object({
  markdown:  z.string().max(2_000_000).optional(),
  subject:   z.string().max(200).optional(),
  title:     z.string().max(200).optional(),
  subjectId: z.string().nullable().optional(),
  subfolder: z.string().max(300).nullable().optional(),
}).refine(b => Object.values(b).some(v => v !== undefined), {
  message: 'markdown, subject, title, subjectId ou subfolder requis',
});

notesRouter.patch('/:id', async (req, res) => {
  const { markdown, subject, title, subjectId, subfolder } = parse(patchSchema, req.body);

  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });

  if (markdown !== undefined) {
    if (markdown.trim().length === 0) return res.status(400).json({ error: 'markdown ne peut pas être vide' });
    // Sur une note issue de photos, les mots corrigés à la main sont retenus pour la matière.
    const subject = note.sourcePaths?.length ? db.data.subjects.find(s => s.id === note.subjectId) : null;
    const before = subject ? await fs.promises.readFile(note.path, 'utf8').catch(() => null) : null;
    await fs.promises.writeFile(note.path, markdown, 'utf8');
    if (before !== null) recordCorrections(subject, extractCorrections(before, markdown));
  }

  if (title?.trim()) note.title = title.trim();

  if (subject?.trim()) {
    const name = subject.trim();
    let sub = db.data.subjects.find(s => s.name.toLowerCase() === name.toLowerCase()
      && (!note.levelId || s.levelId === note.levelId));
    if (!sub) {
      // Matière créée à la volée : on la complète pour qu'elle soit utilisable à l'ingestion.
      const levelId = note.levelId ?? db.data.settings.currentLevelId ?? db.data.levels[0]?.id ?? null;
      if (!levelId) return res.status(400).json({ error: 'Crée d\'abord un niveau pour pouvoir ajouter une matière' });
      sub = { id: randomUUID(), name, levelId, prompt: 'default', outputFolder: name };
      db.data.subjects.push(sub);
    }
    note.subjectId = sub.id;
  }

  if (subjectId?.trim()) {
    const sub = db.data.subjects.find(s => s.id === subjectId);
    if (!sub) return res.status(400).json({ error: 'matière introuvable' });
    note.subjectId = sub.id;
  }

  if (subfolder !== undefined) {
    const sf = sanitizeRelPath(subfolder).join('/');
    if (sf) note.subfolder = sf;
    else delete note.subfolder;
  }

  note.updatedAt = new Date().toISOString();
  await db.write();
  res.json(withNames(note));
});

notesRouter.get('/:id/sources', async (req, res) => {
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  const existing = await Promise.all((note.sourcePaths ?? []).map(async p => ((await statOrNull(p)) ? p : null)));
  res.json(existing.filter(Boolean).map((p, i) => ({
    index: i, filename: path.basename(p), url: `/api/notes/${note.id}/sources/${encodeURIComponent(path.basename(p))}`,
  })));
});

notesRouter.get('/:id/sources/:filename', async (req, res) => {
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  const filePath = (note.sourcePaths ?? []).find(p => path.basename(p) === req.params.filename);
  if (!filePath || !(await statOrNull(filePath))) {
    return res.status(404).json({ error: 'fichier introuvable' });
  }
  res.sendFile(filePath);
});

notesRouter.delete('/:id', async (req, res) => {
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });

  const entry = buildTrashEntry(note);
  db.data.trash.push(entry);
  db.data.notes = db.data.notes.filter(n => n.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
