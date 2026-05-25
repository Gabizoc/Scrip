// backend/src/webdav.js
import webdavPkg from 'webdav-server';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const { v2: webdav } = webdavPkg;

// Credentials for the internal WebDAV bypass user (not exposed externally)
const BYPASS_USER = 'scrip-internal';
const BYPASS_PASS = 'bypass-' + Math.random().toString(36).slice(2);

// Internal user manager with a single bypass user
const _userManager = new webdav.SimpleUserManager();
_userManager.addUser(BYPASS_USER, BYPASS_PASS, true);

// Cache du serveur WebDAV — recréé si vaultPath change
let _server = null;
let _vaultPath = null;

/**
 * Retourne (et met en cache) le WebDAVServer pour le vaultPath donné.
 * Si vaultPath a changé, recrée le serveur.
 * Le serveur utilise un utilisateur bypass interne — l'auth réelle est gérée
 * par notre middleware Express avant délégation.
 */
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

/**
 * Retourne un middleware Express qui :
 * 1. Vérifie que WebDAV est activé (sinon 503)
 * 2. Vérifie la basic auth (sinon 401)
 * 3. Délègue au serveur WebDAV (en injectant les credentials bypass internes)
 */
export function createWebdavMiddleware() {
  return async (req, res, next) => {
    try {
      await db.read();
      const { webdav: cfg, vaultPath } = db.data.settings;

      // 1. Vérification activation
      if (!vaultPath) {
        return res.status(503).json({ error: 'Vault path non configuré dans les paramètres Scrip' });
      }
      if (!cfg?.enabled) {
        return res.status(503).json({ error: 'WebDAV désactivé dans les paramètres Scrip' });
      }

      // 2. Basic auth
      const authHeader = req.headers['authorization'] ?? '';
      if (!authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
        return res.status(401).end('Authentification requise');
      }

      const decoded  = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx === -1) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
        return res.status(401).end('Authentification requise');
      }
      const username = decoded.slice(0, colonIdx);
      const password = decoded.slice(colonIdx + 1);

      const usernameOk = cfg.username === username;
      const passwordOk = cfg.passwordHash
        ? await bcrypt.compare(password, cfg.passwordHash)
        : false;

      if (!usernameOk || !passwordOk) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
        return res.status(401).end('Identifiants incorrects');
      }

      // 3. Servir le WebDAV
      // On remplace l'en-tête Authorization par les credentials bypass internes
      // pour que le serveur webdav-server accepte la requête sans refaire une auth.
      req.headers['authorization'] =
        `Basic ${Buffer.from(`${BYPASS_USER}:${BYPASS_PASS}`).toString('base64')}`;

      const server = await getWebdavServer(vaultPath);
      webdav.extensions.express('/', server)(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
