import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from './db.js';
import { log } from './lib/logger.js';

// File d'ingestion persistante : chaque tâche est enregistrée dans db.data.jobs et ses
// photos dans data/uploads/<jobId>. Les tâches sont traitées une par une ; au démarrage,
// celles qui étaient en attente ou interrompues sont relancées.

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const UPLOADS_TMP_DIR = path.join(UPLOADS_DIR, 'tmp');

const KEEP_FINISHED_MS = 24 * 60 * 60 * 1000;

const emitters = new Map();
const queue = [];
let running = false;
let processor = null;

function emitterFor(id) {
  let e = emitters.get(id);
  if (!e) {
    e = new EventEmitter();
    emitters.set(id, e);
  }
  return e;
}

function findJob(id) {
  return db.data.jobs.find(j => j.id === id);
}

async function moveFile(from, to) {
  try {
    await fs.promises.rename(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fs.promises.copyFile(from, to);
    await fs.promises.unlink(from);
  }
}

// processor(job, { step, warn }) doit renvoyer l'enregistrement de la note créée.
export function setJobProcessor(fn) {
  processor = fn;
}

export async function enqueueJob({ files, params }) {
  const id = randomUUID();
  const dir = path.join(UPLOADS_DIR, id);
  await fs.promises.mkdir(dir, { recursive: true });

  const stored = [];
  for (const [i, f] of files.entries()) {
    const ext = path.extname(f.originalname) || '.jpg';
    const dest = path.join(dir, `${String(i + 1).padStart(2, '0')}${ext}`);
    await moveFile(f.path, dest);
    stored.push({ path: dest, originalname: f.originalname });
  }

  db.data.jobs.push({
    id, status: 'pending', createdAt: new Date().toISOString(), params, files: stored, steps: [], warnings: [], noteId: null, error: null,
  });
  await db.write();

  queue.push(id);
  drain();
  return id;
}

export function getJob(id) {
  return findJob(id);
}

export function subscribe(id, handlers) {
  const e = emitterFor(id);
  for (const [event, fn] of Object.entries(handlers)) e.on(event, fn);
  return () => {
    for (const [event, fn] of Object.entries(handlers)) e.off(event, fn);
  };
}

export function listActiveJobs() {
  return db.data.jobs.filter(j => j.status === 'pending' || j.status === 'running');
}

function contextFor(job) {
  const e = emitterFor(job.id);
  return {
    step(step) {
      const idx = job.steps.findIndex(s => s.id === step.id);
      if (idx >= 0) job.steps[idx] = step;
      else job.steps.push(step);
      e.emit('step', step);
    },
    warn(message, level = 'warn') {
      const w = { message, level };
      job.warnings.push(w);
      e.emit('warning', w);
    },
  };
}

async function runJob(job) {
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  await db.write();

  const e = emitterFor(job.id);
  try {
    const note = await processor(job, contextFor(job));
    job.status = 'done';
    job.noteId = note.id;
    e.emit('done', { note: { id: note.id, title: note.title } });
  } catch (err) {
    log.error({ err, jobId: job.id }, '[ingest] échec du traitement');
    job.status = 'error';
    job.error = err.message ?? String(err);
    e.emit('failed', job.error);
  }

  job.finishedAt = new Date().toISOString();
  job.files = [];
  await db.write();
  await fs.promises.rm(path.join(UPLOADS_DIR, job.id), { recursive: true, force: true });
  setTimeout(() => emitters.delete(job.id), 60_000).unref();
}

async function drain() {
  if (running || !processor) return;
  running = true;
  try {
    while (queue.length) {
      const job = findJob(queue.shift());
      if (job?.status === 'pending') await runJob(job);
    }
  } finally {
    running = false;
  }
}

// À appeler au démarrage, après initDb() et setJobProcessor().
export async function resumeJobs() {
  const cutoff = Date.now() - KEEP_FINISHED_MS;
  db.data.jobs = db.data.jobs.filter(j =>
    j.status === 'pending' || j.status === 'running' || new Date(j.finishedAt ?? j.createdAt).getTime() > cutoff);

  for (const job of db.data.jobs) {
    if (job.status !== 'pending' && job.status !== 'running') continue;
    job.status = 'pending';
    job.steps = [];
    job.warnings = [];
    queue.push(job.id);
  }
  await db.write();

  await fs.promises.rm(UPLOADS_TMP_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(UPLOADS_TMP_DIR, { recursive: true });

  if (queue.length) log.info(`[ingest] reprise de ${queue.length} tâche(s) en attente`);
  drain();
}
