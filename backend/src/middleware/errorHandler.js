import multer from 'multer';
import { log } from '../lib/logger.js';

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE:  'Photo trop lourde (20 Mo maximum)',
  LIMIT_FILE_COUNT: 'Trop de photos (10 maximum)',
  LIMIT_UNEXPECTED_FILE: 'Champ de fichier inattendu',
};

export function errorHandler(err, req, res, _next) {
  if (err instanceof multer.MulterError) {
    err.status = 400;
    err.message = MULTER_MESSAGES[err.code] ?? err.message;
  }
  const status = err.status ?? 500;
  if (status >= 500) log.error({ err, url: req.originalUrl }, '[error]');
  else log.warn(`[error] ${status} ${req.method} ${req.originalUrl} : ${err.message}`);

  const isClientError = status >= 400 && status < 500;
  const message = (isClientError || process.env.NODE_ENV !== 'production')
    ? (err.message ?? 'Erreur interne du serveur')
    : 'Erreur interne du serveur';
  res.status(status).json({ error: message });
}
