export function requireAuth(req, res, next) {
  if (req.session?.loggedIn === true) return next();
  res.status(401).json({ error: 'Non authentifié' });
}
