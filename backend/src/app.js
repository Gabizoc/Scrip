import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import path from 'node:path';
import { FileSessionStore, SESSION_COOKIE } from './session-store.js';
import { DATA_DIR, PROJECT_ROOT } from './db.js';
import { errorHandler }           from './middleware/errorHandler.js';
import { requireAuth }            from './middleware/requireAuth.js';
import { loginLimiter }           from './middleware/rateLimit.js';
import { authRouter }             from './routes/auth.js';
import { settingsRouter }         from './routes/settings.js';
import { levelsRouter }           from './routes/levels.js';
import { subjectsRouter }         from './routes/subjects.js';
import { notesRouter }            from './routes/notes.js';
import { trashRouter }            from './routes/trash.js';
import { ingestRouter }           from './routes/ingest.js';
import { promptsRouter }          from './routes/prompts.js';
import { createWebdavMiddleware } from './webdav.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Le backend ne sert que du JSON et du WebDAV : pas besoin de CSP pour des pages HTML.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));

  if (process.env.NODE_ENV !== 'production') {
    const frontendPort = process.env.FRONTEND_PORT ?? 5000;
    app.use(cors({ origin: `http://localhost:${frontendPort}`, credentials: true }));
  }

  app.use(express.json({ limit: '2mb' }));

  const sessionStore = new FileSessionStore({ path: path.join(DATA_DIR, 'sessions.json') });

  app.use(session({
    name: SESSION_COOKIE, store: sessionStore, secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000, }, }));

  app.use(['/api/auth/login', '/api/auth/magic', '/api/auth/forgot', '/api/auth/reset', '/api/auth/setup-request', '/api/auth/setup-complete', '/api/auth/change-password'], loginLimiter);
  app.use('/api/auth', authRouter);

  app.use('/api', requireAuth);

  app.use('/api/settings', settingsRouter);
  app.use('/api/levels', levelsRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/trash', trashRouter);
  app.use('/api/ingest', ingestRouter);
  app.use('/api/prompts', promptsRouter);

  app.use('/webdav', createWebdavMiddleware());

  // Sert le frontend compilé (image Docker, ou déploiement sans nginx devant).
  if (process.env.SERVE_FRONTEND === 'true') {
    const dist = path.join(PROJECT_ROOT, 'frontend', 'dist');
    app.use(express.static(dist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
        else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get(/^\/(?!api\/|webdav\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
