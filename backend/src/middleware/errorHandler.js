// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err.message);
  const status = err.status ?? 500;
  const isClientError = status >= 400 && status < 500;
  const message = (isClientError || process.env.NODE_ENV !== 'production')
    ? (err.message ?? 'Erreur interne du serveur')
    : 'Erreur interne du serveur';
  res.status(status).json({ error: message });
}
