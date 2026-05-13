// backend/src/routes/ingest.js
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { runOCR } from '../pipeline/ocr.js';
import { structureContent } from '../pipeline/structure.js';
import { buildNote } from '../pipeline/format.js';
import { writeAuditLog, parseMetadata } from '../pipeline/audit.js';

const upload = multer({ dest: '/tmp/scrip-uploads/' });
export const ingestRouter = Router();

function sanitizeFilename(name) {
  return name
    .replace(/[—–]/g, '-')
    .replace(/[/\\:*?"<>|]/g, '-')
    .trim();
}

function nextAvailablePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let n = 1;
  while (fs.existsSync(path.join(dir, `${base} (${n})${ext}`))) n++;
  return path.join(dir, `${base} (${n})${ext}`);
}

ingestRouter.post('/', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo requise' });

    const { subjectId, levelId } = req.body;
    await db.read();

    const subject = db.data.subjects.find(s => s.id === subjectId);
    if (!subject) return res.status(400).json({ error: 'matière introuvable' });

    const level = db.data.levels.find(
      l => l.id === (levelId ?? subject.levelId)
    );
    if (!level) return res.status(400).json({ error: 'niveau introuvable' });

    const mistralKey = process.env.MISTRAL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    // Pipeline IA
    const { rawMarkdown, imageRegions } = await runOCR(req.file.path, mistralKey);
    const structured = await structureContent(
      rawMarkdown, subject.prompt, level.name, openrouterKey, mistralKey
    );

    const now = new Date();
    const note = buildNote(structured, {
      subject: subject.name,
      level: level.name,
      dateCours: now.toISOString().split('T')[0],
      dateIngestion: now.toISOString(),
      sources: [req.file.originalname],
    });

    // Extraire le titre depuis le contenu structuré
    const titleMatch = structured.match(/^#\s+(?![IVX]+[-.\s]|\d+[-.\s])(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].trim()
      : path.basename(req.file.originalname, path.extname(req.file.originalname));

    // Sauvegarder sur disque dans le vault
    const vaultPath = db.data.settings.vaultPath;
    const noteDir = path.join(vaultPath, level.name, subject.outputFolder);
    fs.mkdirSync(noteDir, { recursive: true });

    const notePath = nextAvailablePath(
      path.join(noteDir, `${sanitizeFilename(title)}.md`)
    );
    fs.writeFileSync(notePath, note, 'utf8');

    // Nettoyer le fichier uploadé temporaire
    fs.unlinkSync(req.file.path);

    // Audit log
    const auditPath = writeAuditLog(
      structured, imageRegions, req.file.originalname, now.toISOString()
    );
    const metadata = parseMetadata(structured);

    const noteRecord = {
      id: randomUUID(),
      title,
      subjectId: subject.id,
      levelId: level.id,
      path: notePath,
      auditPath: auditPath ?? null,
      createdAt: now.toISOString(),
      metadata,
    };

    db.data.notes.push(noteRecord);
    await db.write();

    res.status(201).json({ note: noteRecord, markdown: note });
  } catch (err) {
    // Nettoyer le fichier upload en cas d'erreur
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
});
