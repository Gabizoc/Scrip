import pino from 'pino';

// LOG_LEVEL=debug affiche les traces détaillées du pipeline (contenu OCR inclus).
// DEBUG_PIPELINE=true active aussi ce niveau, par compatibilité.
const level = process.env.LOG_LEVEL
  ?? (process.env.DEBUG_PIPELINE === 'true' ? 'debug' : 'info');

export const log = pino({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
