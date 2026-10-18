import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { db, resolveVaultPath } from '../db.js';
import { buildNote } from '../pipeline/format.js';
import { writeAuditLog } from '../pipeline/audit.js';
import { scoreNote } from '../pipeline/score.js';
import { replaceSimpleLatex } from '../pipeline/format-rules.js';
import { saveDebugLog } from '../pipeline/debug-log.js';
import { summarizeNote } from '../pipeline/summarize.js';
import { PIPELINE_MODE, checkPipelineConfig, selectProvider, getProvider } from '../pipeline/providers.js';
import { enqueueJob, getJob, subscribe, listActiveJobs, setJobProcessor, UPLOADS_TMP_DIR } from '../jobs.js';
import { sanitizeSegment, sanitizeRelPath, safeJoin, noteFolderSegments } from '../lib/paths.js';
import { parse, z } from '../lib/validate.js';
import { log } from '../lib/logger.js';
import { DEFAULT_SYSTEM_PROMPT } from '../../prompts/default.js';

const PROMPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prompts');

const PROMPT_KEY_RE = /^[a-z0-9_-]+$/;

async function resolvePrompt(key) {
  if (!key || key === 'default') return DEFAULT_SYSTEM_PROMPT;
  if (!PROMPT_KEY_RE.test(key)) return DEFAULT_SYSTEM_PROMPT;
  const file = path.join(PROMPTS_DIR, `${key}.js`);
  if (!fs.existsSync(file)) return DEFAULT_SYSTEM_PROMPT;
  try {
    const mod = await import(pathToFileURL(file).href);
    return mod.prompt ?? DEFAULT_SYSTEM_PROMPT;
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

const DEBUG_PIPELINE = process.env.DEBUG_PIPELINE === 'true';

// HEIC/HEIF n'est pas lisible par sharp (build sans décodeur HEVC) : on le refuse explicitement.
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const HEIC_MIMES = new Set(['image/heic', 'image/heif']);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const upload = multer({
  dest: UPLOADS_TMP_DIR,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    if (HEIC_MIMES.has(file.mimetype)) {
      return cb(badRequest(`« ${file.originalname} » est au format HEIC, non pris en charge. Sur iPhone : Réglages → Appareil photo → Formats → « Le plus compatible ».`));
    }
    cb(badRequest(`« ${file.originalname} » : format non pris en charge (JPEG, PNG ou WebP uniquement)`));
  },
});

const ingestSchema = z.object({
  subjectId: z.string({ error: 'matière requise' }).min(1, 'matière requise'),
  levelId:   z.string().optional(),
  userNote:  z.string().max(2000).optional(),
  subfolder: z.string().max(300).optional(),
});

export const ingestRouter = Router();

async function cleanupFiles(files = []) {
  await Promise.all(files.map(f => f?.path && fs.promises.rm(f.path, { force: true })));
}

async function nextAvailablePath(filePath) {
  const exists = (p) => fs.promises.access(p).then(() => true, () => false);
  if (!(await exists(filePath))) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let n = 1;
  while (await exists(path.join(dir, `${base} (${n})${ext}`))) n++;
  return path.join(dir, `${base} (${n})${ext}`);
}

ingestRouter.post('/', upload.array('photos', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) throw badRequest('au moins une photo requise');

    const { subjectId, levelId, userNote, subfolder } = parse(ingestSchema, req.body);

    const subject = db.data.subjects.find(s => s.id === subjectId);
    if (!subject) throw badRequest('matière introuvable');

    const level = db.data.levels.find(l => l.id === (levelId ?? subject.levelId));
    if (!level) throw badRequest('niveau introuvable');

    const configError = checkPipelineConfig();
    if (configError) {
      const err = new Error(configError);
      err.status = 500;
      throw err;
    }

    const jobId = await enqueueJob({
      files: req.files,
      params: { subjectId: subject.id, levelId: level.id, userNote: userNote?.trim() || null, subfolder: subfolder?.trim() || null },
    });
    res.status(202).json({ jobId });
  } catch (err) {
    await cleanupFiles(req.files);
    next(err);
  }
});

// Tâches en attente ou en cours (pour afficher la file côté client).
ingestRouter.get('/jobs', (req, res) => {
  res.json(listActiveJobs().map(j => ({
    id: j.id, status: j.status, createdAt: j.createdAt, pages: j.files.length, subject: db.data.subjects.find(s => s.id === j.params.subjectId)?.name ?? null,
  })));
});

ingestRouter.get('/:jobId/events', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job introuvable' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  job.steps.forEach(step => send('step', step));
  job.warnings.forEach(w => send('warning', w));

  if (job.status === 'done') {
    const note = db.data.notes.find(n => n.id === job.noteId);
    send('done', { note: { id: job.noteId, title: note?.title ?? null } });
    return res.end();
  }
  if (job.status === 'error') {
    send('error', { message: job.error });
    return res.end();
  }

  const unsubscribe = subscribe(job.id, {
    step:    step => send('step', step),
    warning: w => send('warning', w),
    done:    result => { send('done', result); res.end(); },
    failed:  message => { send('error', { message }); res.end(); },
  });

  // Garde la connexion ouverte derrière les proxys pendant les longues analyses.
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

const stripFences = (text) => text
  .replace(/^```(?:markdown)?\s*\n?/i, '')
  .replace(/\n?```\s*$/i, '')
  .trim();

async function runPipeline(job, { step, warn }) {
  const { files, params } = job;
  const subject = db.data.subjects.find(s => s.id === params.subjectId);
  if (!subject) throw new Error('matière introuvable (supprimée entre-temps ?)');
  const level = db.data.levels.find(l => l.id === params.levelId);
  if (!level) throw new Error('niveau introuvable (supprimé entre-temps ?)');

  const systemPrompt = await resolvePrompt(subject.prompt);
  const imagePaths = files.map(f => f.path);
  const pageDetail = `${files.length} page${files.length > 1 ? 's' : ''}`;

  const mode = await selectProvider();
  if (PIPELINE_MODE === 'auto') log.info(`[auto] mode sélectionné : ${mode}`);
  const provider = getProvider(mode);

  step({ id: 'ocr', label: provider.label, status: 'running', detail: pageDetail });
  step({ id: 'structure', label: 'Structuration du contenu', status: 'pending' });

  const { rawMarkdown, rawStructured, imageRegions, detail, usedFallback, fallbackWarning } =
    await provider.run(imagePaths, { userNote: params.userNote, systemPrompt, level });

  log.debug(`=== SORTIE ${mode.toUpperCase()} (${rawMarkdown.length} chars) ===\n${rawMarkdown.slice(0, 800)}`);
  step({ id: 'ocr', label: provider.label, status: 'done', detail: `${pageDetail} · ${wordCount(rawMarkdown)} mots extraits` });
  step({ id: 'structure', label: 'Structuration du contenu', status: 'done', detail });
  if (usedFallback) warn(fallbackWarning);

  step({ id: 'format', label: 'Mise en forme', status: 'running' });
  const structured = replaceSimpleLatex(stripFences(rawStructured));
  const contentForFile = structured.replace(/\n*<!--\s*METADATA[\s\S]*?-->\s*$/i, '').trim();

  const now = new Date();
  const note = buildNote(contentForFile, {
    subject: subject.name,
    level: level.name,
    dateCours: now.toISOString().split('T')[0],
    dateIngestion: now.toISOString(),
    sources: files.map(f => f.originalname),
  });
  const lineCount = contentForFile.split('\n').filter(l => l.trim()).length;
  step({ id: 'format', label: 'Mise en forme', status: 'done', detail: `${lineCount} lignes` });

  step({ id: 'summary', label: 'Résumé automatique', status: 'running' });
  const resume = await summarizeNote(note, level.name, process.env.OPENROUTER_API_KEY).catch(() => null);
  step({ id: 'summary', label: 'Résumé automatique', status: 'done', ...(resume ? {} : { detail: 'ignoré' }) });

  step({ id: 'save', label: 'Sauvegarde de la note', status: 'running' });
  const titleMatch = contentForFile.match(/^#\s+(.+)$/m);
  const title = titleMatch
    ? titleMatch[1].trim()
    : path.basename(files[0].originalname, path.extname(files[0].originalname));

  const vaultPath = resolveVaultPath(db.data.settings.vaultPath);
  const subfolderSegments = sanitizeRelPath(params.subfolder);
  const noteDir = safeJoin(vaultPath, ...noteFolderSegments(db.data.settings, level, subject), ...subfolderSegments);
  await fs.promises.mkdir(noteDir, { recursive: true });

  const notePath = await nextAvailablePath(path.join(noteDir, `${sanitizeSegment(title) || 'note'}.md`));
  await fs.promises.writeFile(notePath, note, 'utf8');

  const noteId = randomUUID();
  const sourcesDir = path.join(vaultPath, '_sources', noteId);
  await fs.promises.mkdir(sourcesDir, { recursive: true });
  const sourcePaths = await Promise.all(files.map(async (f, i) => {
    const ext = path.extname(f.originalname) || '.jpg';
    const dest = path.join(sourcesDir, `photo_${String(i + 1).padStart(2, '0')}${ext}`);
    await fs.promises.copyFile(f.path, dest);
    return dest;
  }));

  const auditDir = path.join(vaultPath, '_audit');
  const sourceNames = files.map(f => f.originalname).join(', ');
  const auditPath = writeAuditLog(structured, imageRegions, sourceNames, now.toISOString(), auditDir);
  let metadata = {};
  try {
    const { score, errors, total, samples } = scoreNote(contentForFile);
    metadata = {
      qualite_francais: score,
      ...(errors > 0 ? { erreurs_ortho: errors, mots_total: total } : {}),
      ...(samples.length > 0 ? { exemples_erreurs: samples.join(', ') } : {}),
    };
    const numScore = parseInt(String(score).split('/')[0], 10);
    if (!isNaN(numScore) && numScore < 70) {
      warn(
        `Score de qualité faible (${score}) — ${errors} mot${errors > 1 ? 's' : ''} suspect${errors > 1 ? 's' : ''} détecté${errors > 1 ? 's' : ''}` +
        (samples.length > 0 ? ` : ${samples.slice(0, 3).join(', ')}` : '') +
        '. Vérifiez la note.',
        'warn'
      );
    }
  } catch (err) {
    log.warn(`[score] erreur scoring (ignorée): ${err.message}`);
  }

  if (DEBUG_PIPELINE || usedFallback) {
    saveDebugLog(vaultPath, {
      mode,
      sources: sourceNames,
      subject: subject.name,
      level: level.name,
      ocr_raw_length: rawMarkdown.length,
      ocr_raw_preview: rawMarkdown.slice(0, 2000),
      llm_output_length: structured.length,
      llm_output_preview: structured.slice(0, 2000),
      fallback_used: !!usedFallback,
      validation_ratio: (structured.length / rawMarkdown.length).toFixed(2),
    });
  }

  if (resume) metadata.resume = resume;

  const noteRecord = {
    id: noteId,
    title,
    subjectId: subject.id,
    levelId: level.id,
    path: notePath,
    auditPath: auditPath ?? null,
    sourcePaths,
    createdAt: now.toISOString(),
    metadata,
    ...(subfolderSegments.length > 0 ? { subfolder: subfolderSegments.join('/') } : {}),
  };

  db.data.notes.push(noteRecord);
  await db.write();
  step({ id: 'save', label: 'Sauvegarde de la note', status: 'done', detail: title });

  return noteRecord;
}

setJobProcessor(runPipeline);
