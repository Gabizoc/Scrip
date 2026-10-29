import path from 'node:path';

// Nettoie un segment de chemin fourni par l'utilisateur (nom de niveau, matière, sous-dossier…).
export function sanitizeSegment(name) {
  return String(name ?? '')
    .replace(/[—–]/g, '-')
    // eslint-disable-next-line no-control-regex -- caractères de contrôle interdits dans un nom de fichier
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^\.+/, '')
    .trim();
}

// Découpe un chemin relatif "a/b/c" en segments nettoyés, sans "." ni "..".
export function sanitizeRelPath(rel) {
  return String(rel ?? '')
    .split(/[/\\]/)
    .filter(s => !/^\s*\.+\s*$/.test(s))
    .map(sanitizeSegment)
    .filter(Boolean);
}

export function isInside(base, target) {
  const b = path.resolve(base);
  const t = path.resolve(target);
  return t === b || t.startsWith(b + path.sep);
}

// Joint des segments sous `base` et lève une erreur 400 si le résultat en sort.
export function safeJoin(base, ...segments) {
  const target = path.join(base, ...segments);
  if (!isInside(base, target)) {
    const err = new Error('Chemin invalide');
    err.status = 400;
    throw err;
  }
  return target;
}

// Dossier d'une note dans le vault : [syncFolder]/<niveau>/<dossier de la matière>.
export function noteFolderSegments(settings, level, subject) {
  return [
    ...sanitizeRelPath(settings.syncFolder),
    ...(level ? [sanitizeSegment(level.name)] : []),
    ...(subject ? sanitizeRelPath(subject.outputFolder ?? subject.name) : []),
  ].filter(Boolean);
}
