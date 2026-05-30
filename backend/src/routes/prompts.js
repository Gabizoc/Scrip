import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROMPTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../prompts'
);

export const promptsRouter = Router();

promptsRouter.get('/', async (req, res) => {
  let files;
  try {
    files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.js') && !f.includes('.example'));
  } catch {
    return res.json([]);
  }

  const results = await Promise.all(files.map(async (file) => {
    const key = file.replace('.js', '');
    try {
      const mod = await import(pathToFileURL(path.join(PROMPTS_DIR, file)).href);
      return { key, name: mod.name ?? key };
    } catch {
      return null;
    }
  }));

  res.json(results.filter(Boolean));
});
