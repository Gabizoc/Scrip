// backend/src/middleware/requireAuth.js

/**
 * Middleware Express : vérifie que la session contient loggedIn === true.
 * Retourne 401 JSON si non authentifié.
 */
export function requireAuth(req, res, next) {
  if (req.session?.loggedIn === true) return next();
  res.status(401).json({ error: 'Non authentifié' });
}
