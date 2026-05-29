import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileSessionStore } from './session-store.js';
import { errorHandler }           from './middleware/errorHandler.js';
import { requireAuth }            from './middleware/requireAuth.js';
import { authRouter }             from './routes/auth.js';
import { settingsRouter }         from './routes/settings.js';
import { levelsRouter }           from './routes/levels.js';
import { subjectsRouter }         from './routes/subjects.js';
import { notesRouter }            from './routes/notes.js';
import { trashRouter }            from './routes/trash.js';
import { ingestRouter }           from './routes/ingest.js';
import { createWebdavMiddleware } from './webdav.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? false
      : 'http://localhost:5000',
    credentials: true,
  }));

  app.use(express.json());

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sessionStore = new FileSessionStore({
    path: path.resolve(__dirname, '../data/sessions.json'),
  });

  app.use(session({
    store:             sessionStore,
    secret:            process.env.SESSION_SECRET ?? 'dev-secret-change-me',
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    },
  }));

  // Routes auth — PUBLIQUES (avant requireAuth)
  app.use('/api/auth', authRouter);

  // Toutes les autres routes /api/* nécessitent une session
  app.use('/api', requireAuth);

  app.use('/api/settings', settingsRouter);
  app.use('/api/levels',   levelsRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/notes',    notesRouter);
  app.use('/api/trash',    trashRouter);
  app.use('/api/ingest',   ingestRouter);

  app.use('/webdav', createWebdavMiddleware());

  app.use(errorHandler);
  return app;
}
