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
import { promptsRouter }          from './routes/prompts.js';
import { createWebdavMiddleware } from './webdav.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? false
      : 'http://localhost:5000', credentials: true, }));

  app.use(express.json({ limit: '2mb' }));

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sessionStore = new FileSessionStore({
    path: path.resolve(__dirname, '../data/sessions.json'), });

  app.use(session({
    store: sessionStore, secret: process.env.SESSION_SECRET ?? '85WzN50dmKjTjw3YMjs', resave: false, saveUninitialized: false, cookie: {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000, }, }));

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

  app.use(errorHandler);
  return app;
}
