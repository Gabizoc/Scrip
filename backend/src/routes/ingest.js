import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { db, resolveVaultPath } from '../db.js';
import { runOCR } from '../pipeline/ocr.js';
import { structureContent } from '../pipeline/structure.js';
import { runVisionPipeline } from '../pipeline/vision.js';
import { runGoogleVisionPipeline } from '../pipeline/google-vision.js';
import { runOllamaPipeline } from '../pipeline/ollama.js';
import { buildNote } from '../pipeline/format.js';
import { writeAuditLog } from '../pipeline/audit.js';
import { scoreNote } from '../pipeline/score.js';
import { isOutputValid, applyRulesFormat } from '../pipeline/format-rules.js';
import { saveDebugLog } from '../pipeline/debug-log.js';
import { createJob, getJob, emitStep, emitDone, emitError, emitWarning } from '../jobs.js';
import { summarizeNote } from '../pipeline/summarize.js';
import { DEFAULT_SYSTEM_PROMPT } from '../../prompts/default.js';
import { pathToFileURL, fileURLToPath } from 'node:url';

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

const PIPELINE_MODE = process.env.PIPELINE_MODE ?? 'google';
const DEBUG_PIPELINE = process.env.DEBUG_PIPELINE === 'true';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const upload = multer({
  dest: path.join(os.tmpdir(), 'scrip-uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIMES.has(file.mimetype)),
});
export const ingestRouter = Router();

function cleanupFiles(files = []) {
  for (const f of files) {
    if (f?.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
  }
}

function sanitizeFilename(name) {
  return name
    .replace(/[—–]/g, '-')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '-')
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

ingestRouter.post('/', upload.array('photos', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'au moins une photo requise' });

  const { subjectId, levelId, userNote, subfolder } = req.body;
  await db.read();

  const subject = db.data.subjects.find(s => s.id === subjectId);
  if (!subject) { cleanupFiles(req.files); return res.status(400).json({ error: 'matière introuvable' }); }

  const level = db.data.levels.find(l => l.id === (levelId ?? subject.levelId));
  if (!level) { cleanupFiles(req.files); return res.status(400).json({ error: 'niveau introuvable' }); }

  const mistralKey = process.env.MISTRAL_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  const ollamaReachable = !!process.env.OLLAMA_BASE_URL;

  if (PIPELINE_MODE === 'google'  && !googleKey)  { cleanupFiles(req.files); return res.status(500).json({ error: 'GOOGLE_API_KEY manquante dans le .env' }); }
  if (PIPELINE_MODE === 'mistral' && !mistralKey)  { cleanupFiles(req.files); return res.status(500).json({ error: 'MISTRAL_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=mistral)' }); }
  if (PIPELINE_MODE === 'nvidia'  && !nvidiaKey)   { cleanupFiles(req.files); return res.status(500).json({ error: 'NVIDIA_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=nvidia)' }); }
  if (PIPELINE_MODE === 'auto' && !ollamaReachable && !googleKey && !nvidiaKey && !mistralKey) {
    cleanupFiles(req.files);
    return res.status(500).json({ error: 'Mode auto : aucune cle API disponible (GOOGLE_API_KEY, NVIDIA_API_KEY ou MISTRAL_API_KEY requise)' });
  }

  const jobId = createJob();
  res.status(202).json({ jobId });

  runPipeline({ jobId, files: req.files, subject, level, mistralKey, openrouterKey, nvidiaKey, googleKey, userNote: userNote ?? null, subfolder: subfolder ?? null })
    .catch(err => {
      emitError(jobId, err.message ?? String(err));
      cleanupFiles(req.files);
    });
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

  if (job.result) { send('done', job.result); res.end(); return; }
  if (job.error)  { send('error', { message: job.error }); res.end(); return; }

  const onStep = step => send('step', step);
  const onDone = result => { send('done', result); res.end(); };
  const onError = message => { send('error', { message }); res.end(); };
  const onWarning = w => send('warning', w);

  job.emitter.on('step',    onStep);
  job.emitter.on('done',    onDone);
  job.emitter.on('error',   onError);
  job.emitter.on('warning', onWarning);

  (job.warnings ?? []).forEach(w => send('warning', w));

  req.on('close', () => {
    job.emitter.off('step',    onStep);
    job.emitter.off('done',    onDone);
    job.emitter.off('error',   onError);
    job.emitter.off('warning', onWarning);
  });
});

async function runPipeline({ jobId, files, subject, level, mistralKey, openrouterKey, nvidiaKey, googleKey, userNote, subfolder }) {
  const step = (id, label, status, detail) =>
    emitStep(jobId, { id, label, status, ...(detail ? { detail } : {}) });
  const warn = (message, level = 'warn') => emitWarning(jobId, message, level);

  const systemPrompt = await resolvePrompt(subject.prompt);

  const imagePaths = files.map(f => f.path);
  const pageDetail = `${files.length} page${files.length > 1 ? 's' : ''}`;
  const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
  let rawMarkdown, imageRegions, rawStructured;

  const effectiveMode = await (async () => {
    if (PIPELINE_MODE !== 'auto') return PIPELINE_MODE;
    const ollamaBase = process.env.OLLAMA_BASE_URL;
    if (ollamaBase) {
      try {
        const r = await fetch(`${ollamaBase.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) return 'ollama';
      } catch {}
    }
    if (googleKey)  return 'google';
    if (nvidiaKey)  return 'nvidia';
    if (mistralKey) return 'mistral';
    return 'google';
  })();

  if (PIPELINE_MODE === 'auto') {
    process.stderr.write(`[auto] mode selectionne : ${effectiveMode}\n`);
  }

  if (effectiveMode === 'ollama') {
    step('ocr', 'Analyse Ollama', 'running', pageDetail);
    step('structure', 'Structuration du contenu', 'pending');

    const ollamaResult = await runOllamaPipeline(imagePaths, userNote);
    rawMarkdown = ollamaResult.rawMarkdown;
    imageRegions = ollamaResult.imageRegions;
    rawStructured = rawMarkdown;

    const model = ollamaResult.modelUsed ?? 'ollama';
    const wc = wordCount(rawMarkdown);
    process.stderr.write(`\n=== OLLAMA OUTPUT (${rawMarkdown.length} chars) ===\n${rawMarkdown.slice(0, 800)}\n===\n\n`);
    step('ocr',       'Analyse Ollama',           'done', `${pageDetail} · ${wc} mots extraits`);
    step('structure', 'Structuration du contenu', 'done', model);

  } else if (effectiveMode === 'google') {
    step('ocr', 'Analyse Gemini', 'running', pageDetail);
    step('structure', 'Structuration du contenu', 'pending');

    const googleResult = await runGoogleVisionPipeline(
      imagePaths, subject.prompt, level.name, googleKey, mistralKey, nvidiaKey, openrouterKey, userNote, systemPrompt
    );
    rawMarkdown = googleResult.rawMarkdown;
    imageRegions = googleResult.imageRegions;
    rawStructured = rawMarkdown;

    const wc = wordCount(rawMarkdown);
    process.stderr.write(`\n=== GEMINI OUTPUT (${rawMarkdown.length} chars) ===\n${rawMarkdown.slice(0, 800)}\n===\n\n`);
    step('ocr',       'Analyse Gemini',            'done', `${pageDetail} · ${wc} mots extraits`);
    const googleDetail = googleResult.usedFallback
      ? 'mise en forme automatique'
      : `Gemini ${googleResult.modelUsed ?? ''}`.trim();
    step('structure', 'Structuration du contenu', 'done', googleDetail);
    if (googleResult.usedFallback) {
      warn('Gemini indisponible ou rejeté — mise en forme automatique utilisée. La note peut nécessiter une relecture.');
    }

  } else if (effectiveMode === 'nvidia') {
    step('ocr', 'Analyse NVIDIA', 'running', pageDetail);
    step('structure', 'Structuration du contenu', 'pending');

    const visionResult = await runVisionPipeline(
      imagePaths, subject.prompt, level.name, nvidiaKey, null, mistralKey, userNote, systemPrompt
    );
    rawMarkdown = visionResult.rawMarkdown;
    imageRegions = visionResult.imageRegions;
    rawStructured = rawMarkdown;

    const wc = wordCount(rawMarkdown);
    process.stderr.write(`\n=== NVIDIA OUTPUT (${rawMarkdown.length} chars) ===\n${rawMarkdown.slice(0, 800)}\n===\n\n`);
    step('ocr',       'Analyse NVIDIA',           'done', `${pageDetail} · ${wc} mots extraits`);
    const visionDetail = visionResult.usedFallback ? 'mise en forme automatique' : 'NVIDIA vision';
    step('structure', 'Structuration du contenu', 'done', visionDetail);
    if (visionResult.usedFallback) {
      warn('Modèle vision indisponible — mise en forme automatique utilisée. La note peut nécessiter une relecture.');
    }

  } else {
    step('ocr', 'OCR Mistral', 'running', pageDetail);
    const ocrResult = await runOCR(imagePaths, mistralKey);
    rawMarkdown = ocrResult.rawMarkdown;
    imageRegions = ocrResult.imageRegions;
    const wc = wordCount(rawMarkdown);
    process.stderr.write(`\n=== OCR BRUT (${rawMarkdown.length} chars) ===\n${rawMarkdown.slice(0, 800)}\n===\n\n`);
    step('ocr', 'Lecture des notes', 'done', `${pageDetail} · ${wc} mots extraits`);

    step('structure', 'Structuration du contenu', 'running', 'LLM en cours…');
    rawStructured = await structureContent(
      rawMarkdown, subject.prompt, level.name, openrouterKey, mistralKey, nvidiaKey
    );

    const llmStripped = rawStructured
      .replace(/^```(?:markdown)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .replace(/\n*<!--\s*METADATA[\s\S]*?-->\s*$/i, '')
      .trim();

    const usedFallback = !isOutputValid(rawMarkdown, llmStripped);
    if (usedFallback) {
      process.stderr.write(`    ↩ Fallback : formateur basé sur des règles\n`);
      rawStructured = applyRulesFormat(rawMarkdown);
      warn('Structuration LLM rejetée (validation échouée) — mise en forme automatique utilisée. La note peut nécessiter une relecture.');
    }
    step('structure', 'Structuration du contenu', 'done', usedFallback ? 'mise en forme automatique' : undefined);
  }

  step('format', 'Mise en forme', 'running');
  const structured = rawStructured
    .replace(/^```(?:markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
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
  step('format', 'Mise en forme', 'done', `${lineCount} lignes`);

  step('summary', 'Résumé automatique', 'running');
  let resume = null;
  try {
    resume = await summarizeNote(note, level.name, openrouterKey);
  } catch {}
  step('summary', 'Résumé automatique', 'done', resume ? undefined : 'ignoré');

  step('save', 'Sauvegarde de la note', 'running');
  const titleMatch = contentForFile.match(/^#\s+(.+)$/m);
  const title = titleMatch
    ? titleMatch[1].trim()
    : path.basename(files[0].originalname, path.extname(files[0].originalname));

  await db.read();
  const vaultPath = resolveVaultPath(db.data.settings.vaultPath);
  const syncFolder = (db.data.settings.syncFolder ?? '').trim();
  const subfolderSegments = (subfolder ?? '')
    .split(/[/\\]/)
    .map(s => sanitizeFilename(s).trim())
    .filter(s => s && s !== '.' && s !== '..');
  const noteDir = path.join(vaultPath, ...(syncFolder ? [syncFolder] : []), level.name, subject.outputFolder, ...subfolderSegments);
  fs.mkdirSync(noteDir, { recursive: true });

  const notePath = nextAvailablePath(
    path.join(noteDir, `${sanitizeFilename(title)}.md`)
  );
  fs.writeFileSync(notePath, note, 'utf8');

  const noteId = randomUUID();
  const sourcesDir = path.join(vaultPath, '_sources', noteId);
  fs.mkdirSync(sourcesDir, { recursive: true });
  const sourcePaths = files.map((f, i) => {
    const ext = path.extname(f.originalname) || '.jpg';
    const dest = path.join(sourcesDir, `photo_${String(i + 1).padStart(2, '0')}${ext}`);
    fs.copyFileSync(f.path, dest);
    return dest;
  });
  cleanupFiles(files);

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
    process.stderr.write(`[score] erreur scoring (ignorée): ${err.message}\n`);
  }

  const hadFallback = rawStructured !== structured && structured.length < rawMarkdown.length * 0.5;
  if (DEBUG_PIPELINE || hadFallback) {
    saveDebugLog(vaultPath, {
      mode: PIPELINE_MODE,
      sources: sourceNames,
      subject: subject.name,
      level: level.name,
      ocr_raw_length: rawMarkdown.length,
      ocr_raw_preview: rawMarkdown.slice(0, 2000),
      llm_output_length: structured.length,
      llm_output_preview: structured.slice(0, 2000),
      fallback_used: hadFallback,
      validation_ratio: (structured.length / rawMarkdown.length).toFixed(2),
    });
  }

  if (resume) metadata.resume = resume;

  const subfolderId = subfolderSegments.length > 0 ? subfolderSegments.join('/') : null;

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
    ...(subfolderId ? { subfolder: subfolderId } : {}),
  };

  db.data.notes.push(noteRecord);
  await db.write();
  step('save', 'Sauvegarde de la note', 'done', title);

  emitDone(jobId, { note: noteRecord, markdown: note });
}
