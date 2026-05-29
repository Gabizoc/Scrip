// backend/src/session-store.js
//
// Store de sessions persistant sur disque (JSON), pour que la connexion survive
// aux redémarrages du backend — le MemoryStore par défaut d'express-session perd
// toutes les sessions à chaque restart. Sans dépendance externe (cohérent avec
// l'approche lowdb/JSON du projet). Usage mono-utilisateur → volume négligeable.

import fs from 'node:fs';
import path from 'node:path';
import session from 'express-session';

const Store = session.Store;

export class FileSessionStore extends Store {
  constructor({ path: filePath, cleanupIntervalMs = 60 * 60 * 1000 } = {}) {
    super();
    this.filePath = filePath;
    this.sessions = new Map(); // sid -> { data: <session>, expires: <ms epoch|null> }
    this._load();
    const timer = setInterval(() => this._cleanup(true), cleanupIntervalMs);
    timer.unref?.();
  }

  _load() {
    try {
      const obj = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      for (const [sid, entry] of Object.entries(obj)) this.sessions.set(sid, entry);
      this._cleanup(false);
    } catch {
      // fichier absent ou corrompu → on repart à vide
    }
  }

  _persist() {
    const tmp = `${this.filePath}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.sessions)), 'utf8');
      fs.renameSync(tmp, this.filePath); // écriture atomique
    } catch {
      /* best-effort */
    }
  }

  _expiryOf(sess) {
    const e = sess?.cookie?.expires;
    if (!e) return null;
    const t = new Date(e).getTime();
    return Number.isFinite(t) ? t : null;
  }

  _cleanup(persist) {
    const now = Date.now();
    let changed = false;
    for (const [sid, entry] of this.sessions) {
      if (entry.expires != null && entry.expires <= now) {
        this.sessions.delete(sid);
        changed = true;
      }
    }
    if (changed && persist) this._persist();
  }

  get(sid, cb) {
    const entry = this.sessions.get(sid);
    if (!entry) return cb(null, null);
    if (entry.expires != null && entry.expires <= Date.now()) {
      this.sessions.delete(sid);
      this._persist();
      return cb(null, null);
    }
    cb(null, JSON.parse(JSON.stringify(entry.data))); // copie défensive
  }

  set(sid, sess, cb) {
    this.sessions.set(sid, { data: sess, expires: this._expiryOf(sess) });
    this._persist();
    cb?.(null);
  }

  destroy(sid, cb) {
    if (this.sessions.delete(sid)) this._persist();
    cb?.(null);
  }

  // Appelé à chaque requête d'une session existante : on rafraîchit l'expiration
  // en mémoire. Pas de réécriture disque ici (l'expiration de 30 jours posée au
  // login est déjà persistée) — évite une écriture à chaque requête.
  touch(sid, sess, cb) {
    const entry = this.sessions.get(sid);
    if (entry) entry.expires = this._expiryOf(sess);
    cb?.(null);
  }
}
