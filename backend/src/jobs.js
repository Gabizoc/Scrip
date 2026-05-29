import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

// Map<jobId, { emitter, steps, result, error }>
const jobs = new Map();

export function createJob() {
  const id = randomUUID();
  const emitter = new EventEmitter();
  jobs.set(id, { emitter, steps: [], result: null, error: null });
  // Nettoyage auto après 15 min
  setTimeout(() => jobs.delete(id), 15 * 60 * 1000);
  return id;
}

export function getJob(id) {
  return jobs.get(id);
}

/** Émet une mise à jour d'étape : { id, label, status: 'running'|'done'|'error', detail? } */
export function emitStep(jobId, step) {
  const job = jobs.get(jobId);
  if (!job) return;
  // Met à jour ou ajoute l'étape
  const existing = job.steps.findIndex(s => s.id === step.id);
  if (existing >= 0) job.steps[existing] = step;
  else job.steps.push(step);
  job.emitter.emit('step', step);
}

/** Émet un avertissement non bloquant : { message, level: 'info'|'warn' } */
export function emitWarning(jobId, message, level = 'warn') {
  const job = jobs.get(jobId);
  if (!job) return;
  if (!job.warnings) job.warnings = [];
  job.warnings.push({ message, level });
  job.emitter.emit('warning', { message, level });
}

export function emitDone(jobId, result) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.result = result;
  job.emitter.emit('done', result);
}

export function emitError(jobId, message) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.error = message;
  job.emitter.emit('error', message);
}
