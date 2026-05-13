// backend/src/middleware/errorHandler.js

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err.message);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Erreur interne du serveur' });
}
