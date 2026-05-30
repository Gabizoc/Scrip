import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, resolveVaultPath } from '../db.js';
import { buildTrashEntry } from '../trash.js';

export const notesRouter = Router();

function publicNote(note) {
  const { path: _path, fileMtime: _ft, ...pub } = note;
  return pub;
}

function extractTitle(markdown) {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+)$/m);
    if (t) return t[1].trim().replace(/^["']|["']$/g, '');
  }
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : null;
}

function findByTitle(searchRoot, title) {
  if (!title || !fs.existsSync(searchRoot)) return null;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_')) {
        const found = walk(full);
        if (found) return found;
      } else if (e.isFile() && e.name.endsWith('.md')) {
        try {
          const t = extractTitle(fs.readFileSync(full, 'utf8'));
          if (t === title) return full;
        } catch { }
      }
    }
    return null;
  };
  return walk(searchRoot);
}

function vaultSearchRoot(settings) {
  const base = resolveVaultPath(settings.vaultPath);
  const sub  = (settings.syncFolder ?? '').trim();
  return sub ? path.join(base, sub) : base;
}

const SKIP_DIRS = new Set(['.obsidian', '_sources', '_audit', '_debug', '.git']);

function walkVault(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) {
      walkVault(full, results);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function inferFromPath(filePath, searchRoot, levels, subjects) {
  const rel   = path.relative(searchRoot, filePath);
  const parts = rel.split(path.sep);
  const levelName   = parts.length > 1 ? parts[0]   : null;
  const subjectName = parts.length > 2 ? parts[1]   : null;
  const levelId   = levelName   ? (levels.find(l   => l.name === levelName)?.id   ?? null) : null;
  const subjectId = subjectName ? (subjects.find(s => s.name === subjectName)?.id ?? null) : null;
  return { levelId, subjectId };
}

notesRouter.get('/', async (req, res) => {
  await db.read();

  let dirty = false;
  const { levels, subjects } = db.data;
  const searchRoot = vaultSearchRoot(db.data.settings);

  const synced = db.data.notes.map(note => {
    if (!note.path) return note;

    if (!fs.existsSync(note.path)) {
      const found = findByTitle(searchRoot, note.title);
      if (found) {
        note = { ...note, path: found };
        dirty = true;
      } else {
        return null;
      }
    }

    try {
      const mtime = fs.statSync(note.path).mtimeMs;
      if (!note.fileMtime || mtime > note.fileMtime) {
        const content  = fs.readFileSync(note.path, 'utf8');
        const newTitle = extractTitle(content);
        note = { ...note, fileMtime: mtime, ...(newTitle ? { title: newTitle } : {}) };
        dirty = true;
      }
    } catch { }

    return note;
  }).filter(Boolean);

  if (fs.existsSync(searchRoot)) {
    const knownPaths = new Set(synced.map(n => n.path));
    const allFiles   = walkVault(searchRoot);

    for (const filePath of allFiles) {
      if (knownPaths.has(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const title   = extractTitle(content) || path.basename(filePath, '.md');
        const stat    = fs.statSync(filePath);
        const { levelId, subjectId } = inferFromPath(filePath, searchRoot, levels, subjects);

        const newNote = {
          id:        randomUUID(),
          title,
          path:      filePath,
          subjectId,
          levelId,
          createdAt: stat.mtime.toISOString(),
          fileMtime: stat.mtimeMs,
          source:    'vault-import',
        };
        synced.push(newNote);
        dirty = true;
      } catch { }
    }
  }

  if (dirty) {
    db.data.notes = synced;
    await db.write();
  }

  res.json(
    synced
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(note => ({
        ...publicNote(note),
        subject: db.data.subjects.find(s => s.id === note.subjectId)?.name ?? note.subjectId,
        level:   db.data.levels.find(l => l.id === note.levelId)?.name   ?? note.levelId,
      }))
  );
});

notesRouter.get('/search', async (req, res) => {
  const q = (req.query.q ?? '').toLowerCase().trim();
  if (q.length < 2) return res.json([]);

  await db.read();
  const results = [];

  for (const note of db.data.notes) {
    const subject = db.data.subjects.find(s => s.id === note.subjectId);
    const level   = db.data.levels.find(l => l.id === note.levelId);
    const enriched = {
      ...publicNote(note),
      subject: subject?.name ?? note.subjectId,
      level:   level?.name   ?? note.levelId,
    };

    if (note.title?.toLowerCase().includes(q)) {
      results.push({ ...enriched, snippet: null });
      continue;
    }

    if (!note.path || !fs.existsSync(note.path)) continue;
    let raw;
    try { raw = fs.readFileSync(note.path, 'utf8'); } catch { continue; }

    const lower = raw.toLowerCase();
    const idx   = lower.indexOf(q);
    if (idx === -1) continue;

    const start   = Math.max(0, idx - 40);
    const end     = Math.min(raw.length, idx + q.length + 50);
    const snippet =
      (start > 0 ? '…' : '') +
      raw.slice(start, end).replace(/[#*`\n]/g, ' ').replace(/\s+/g, ' ').trim() +
      (end < raw.length ? '…' : '');

    results.push({ ...enriched, snippet });
  }

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

  const freshTitle = extractTitle(markdown);
  if (freshTitle && freshTitle !== note.title) {
    note.title = freshTitle;
    await db.write();
  }

  const subject = db.data.subjects.find(s => s.id === note.subjectId);
  const level   = db.data.levels.find(l => l.id === note.levelId);
  res.json({
    ...publicNote(note),
    markdown,
    note: {
      ...publicNote(note),
      subject: subject?.name ?? note.subjectId,
      level:   level?.name   ?? note.levelId,
    },
  });
});

notesRouter.post('/', async (req, res) => {
  const { title, subjectId, levelId, subfolder, markdown } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'titre requis' });

  await db.read();

  let resolvedSubjectId = null;
  if (subjectId) {
    const sub = db.data.subjects.find(s => s.id === subjectId);
    if (!sub) return res.status(400).json({ error: 'matière introuvable' });
    resolvedSubjectId = sub.id;
  }

  const resolvedLevelId = levelId ?? db.data.settings.currentLevelId ?? null;

  const slug = title.trim()
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const id       = randomUUID();
  const filename = `${slug}-${id.slice(0, 8)}.md`;

  const vaultPath = resolveVaultPath(db.data.settings.vaultPath);
  fs.mkdirSync(vaultPath, { recursive: true });
  const filePath = path.join(vaultPath, filename);

  const now     = new Date();
  const content = markdown?.trim() || `# ${title.trim()}\n\n`;
  fs.writeFileSync(filePath, content, 'utf8');

  const note = {
    id,
    title: title.trim(),
    path: filePath,
    subjectId: resolvedSubjectId,
    levelId:   resolvedLevelId,
    subfolder: subfolder?.trim() || undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    sourcePaths: [],
    metadata:    {},
  };
  if (!note.subfolder) delete note.subfolder;

  db.data.notes.push(note);
  await db.write();

  res.status(201).json({
    ...note,
    subject: db.data.subjects.find(s => s.id === note.subjectId)?.name ?? null,
    level:   db.data.levels.find(l => l.id === note.levelId)?.name   ?? null,
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

  if (typeof markdown === 'string') {
    if (markdown.trim().length === 0) return res.status(400).json({ error: 'markdown ne peut pas être vide' });
    fs.writeFileSync(note.path, markdown, 'utf8');
  }

  if (typeof title === 'string' && title.trim().length > 0) {
    note.title = title.trim();
  }

  if (typeof subject === 'string' && subject.trim().length > 0) {
    const name = subject.trim();
    let sub = db.data.subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!sub) {
      sub = { id: randomUUID(), name };
      db.data.subjects.push(sub);
    }
    note.subjectId = sub.id;
  }

  if (typeof subjectId === 'string' && subjectId.trim().length > 0) {
    const sub = db.data.subjects.find(s => s.id === subjectId);
    if (!sub) return res.status(400).json({ error: 'matière introuvable' });
    note.subjectId = sub.id;
  }

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
    ...publicNote(note),
    subject: db.data.subjects.find(s => s.id === note.subjectId)?.name ?? note.subjectId,
  });
});

notesRouter.get('/:id/sources', async (req, res) => {
  await db.read();
  const note = db.data.notes.find(n => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: 'note introuvable' });
  const sources = (note.sourcePaths ?? [])
    .filter(p => fs.existsSync(p))
    .map((p, i) => ({ index: i, filename: path.basename(p), url: `/api/notes/${note.id}/sources/${path.basename(p)}` }));
  res.json(sources);
});

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

  const entry = buildTrashEntry(note);
  db.data.trash = db.data.trash ?? [];
  db.data.trash.push(entry);
  db.data.notes = db.data.notes.filter(n => n.id !== req.params.id);
  await db.write();
  res.status(204).end();
});
