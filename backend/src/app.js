// backend/src/app.js
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { settingsRouter } from './routes/settings.js';
import { levelsRouter } from './routes/levels.js';
import { subjectsRouter } from './routes/subjects.js';
import { notesRouter } from './routes/notes.js';
import { ingestRouter } from './routes/ingest.js';
import { createWebdavMiddleware } from './webdav.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? false       // Nginx handles CORS in prod (same-origin)
      : 'http://localhost:5000',
  }));
  app.use(express.json());

  app.use('/api/settings', settingsRouter);
  app.use('/api/levels',   levelsRouter);
  app.use('/api/subjects', subjectsRouter);
  app.use('/api/notes',    notesRouter);
  app.use('/api/ingest',   ingestRouter);
  app.use('/webdav',       createWebdavMiddleware());

  app.use(errorHandler);
  return app;
}
