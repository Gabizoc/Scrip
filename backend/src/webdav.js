import webdavPkg from 'webdav-server';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { db, resolveVaultPath } from './db.js';

const { v2: webdav } = webdavPkg;

const BYPASS_USER = 'scrip-internal';
const BYPASS_PASS = randomBytes(24).toString('hex');

const _userManager = new webdav.SimpleUserManager();
_userManager.addUser(BYPASS_USER, BYPASS_PASS, true);

// Une synchro Obsidian envoie des centaines de requêtes : on garde en cache les identifiants
// déjà validés (clé = empreinte des identifiants + hash courant, donc invalidée au changement).
const AUTH_CACHE_MS = 5 * 60 * 1000;
const _authCache = new Map();

// Blocage par IP après trop d'échecs d'authentification.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 20;
const _failures = new Map();

function isBlocked(ip) {
  const f = _failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.since > FAIL_WINDOW_MS) {
    _failures.delete(ip);
    return false;
  }
  return f.count >= MAX_FAILS;
}

function recordFailure(ip) {
  const f = _failures.get(ip);
  if (!f || Date.now() - f.since > FAIL_WINDOW_MS) _failures.set(ip, { count: 1, since: Date.now() });
  else f.count++;
}

async function checkCredentials(username, password, cfg, auth) {
  // Mot de passe WebDAV dédié s'il est défini, sinon celui de l'application.
  const hash = cfg.passwordHash ?? auth.passwordHash;
  if (!hash || cfg.username !== username) return false;

  const key = createHash('sha256').update(`${username}:${password}:${hash}`).digest('hex');
  const cached = _authCache.get(key);
  if (cached && cached > Date.now()) return true;

  const ok = await bcrypt.compare(password, hash);
  if (ok) {
    if (_authCache.size > 100) _authCache.clear();
    _authCache.set(key, Date.now() + AUTH_CACHE_MS);
  }
  return ok;
}

let _server = null;
let _vaultPath = null;

async function getWebdavServer(vaultPath) {
  if (_server && _vaultPath === vaultPath) return _server;

  const server = new webdav.WebDAVServer({
    httpAuthentication: new webdav.HTTPBasicAuthentication(_userManager, 'Scrip'),
  });

  await new Promise((resolve, reject) => {
    server.setFileSystem('/', new webdav.PhysicalFileSystem(vaultPath), (success) => {
      if (success) resolve();
      else reject(new Error(`WebDAV: impossible de monter le filesystem ${vaultPath}`));
    });
  });

  _server = server;
  _vaultPath = vaultPath;
  return server;
}

function unauthorized(res, message) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
  return res.status(401).end(message);
}

export function createWebdavMiddleware() {
  return async (req, res, next) => {
    try {
      const { webdav: cfg, auth, vaultPath } = db.data.settings;

      if (!vaultPath) {
        return res.status(503).json({ error: 'Vault path non configuré dans les paramètres Scrip' });
      }
      if (!cfg?.enabled) {
        return res.status(503).json({ error: 'WebDAV désactivé dans les paramètres Scrip' });
      }
      if (isBlocked(req.ip)) {
        return res.status(429).end('Trop de tentatives. Réessaie dans 15 minutes.');
      }

      const authHeader = req.headers['authorization'] ?? '';
      if (!authHeader.startsWith('Basic ')) return unauthorized(res, 'Authentification requise');

      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx === -1) return unauthorized(res, 'Authentification requise');

      const username = decoded.slice(0, colonIdx);
      const password = decoded.slice(colonIdx + 1);

      if (!(await checkCredentials(username, password, cfg, auth))) {
        recordFailure(req.ip);
        return unauthorized(res, 'Identifiants incorrects');
      }

      req.headers['authorization'] =
        `Basic ${Buffer.from(`${BYPASS_USER}:${BYPASS_PASS}`).toString('base64')}`;

      req.url = '/webdav' + (req.url || '/');

      const server = await getWebdavServer(resolveVaultPath(vaultPath));
      webdav.extensions.express('/webdav', server)(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
