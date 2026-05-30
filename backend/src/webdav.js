import webdavPkg from 'webdav-server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { db, resolveVaultPath } from './db.js';

const { v2: webdav } = webdavPkg;

const BYPASS_USER = 'scrip-internal';
const BYPASS_PASS = randomBytes(24).toString('hex');

const _userManager = new webdav.SimpleUserManager();
_userManager.addUser(BYPASS_USER, BYPASS_PASS, true);

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

export function createWebdavMiddleware() {
  return async (req, res, next) => {
    try {
      await db.read();
      const { webdav: cfg, auth, vaultPath } = db.data.settings;

      if (!vaultPath) {
        return res.status(503).json({ error: 'Vault path non configuré dans les paramètres Scrip' });
      }
      if (!cfg?.enabled) {
        return res.status(503).json({ error: 'WebDAV désactivé dans les paramètres Scrip' });
      }

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
      const passwordOk = auth.passwordHash
        ? await bcrypt.compare(password, auth.passwordHash)
        : false;

      if (!usernameOk || !passwordOk) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Scrip"');
        return res.status(401).end('Identifiants incorrects');
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
