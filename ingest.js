#!/usr/bin/env node
// ingest.js
import 'dotenv/config';
import path from 'node:path';
import { runOCR } from './src/ocr.js';
import { structureContent } from './src/structure.js';
import { buildNote } from './src/format.js';

const SUBJECT = 'histoire';
const LEVEL = process.env.SCRIP_LEVEL ?? '1ère';

async function main() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.error('Usage: node ingest.js <chemin_image.jpg>');
    process.exit(1);
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!mistralKey || !openrouterKey) {
    console.error('Erreur : MISTRAL_API_KEY et OPENROUTER_API_KEY doivent être définis dans .env');
    process.exit(1);
  }

  const absolutePath = path.resolve(imagePath);
  const sourceName = path.basename(imagePath);

  process.stderr.write(`[1/3] OCR en cours sur ${sourceName}...\n`);
  const { rawMarkdown } = await runOCR(absolutePath, mistralKey);

  process.stderr.write(`[2/3] Structuration via LLM...\n`);
  const structuredContent = await structureContent(rawMarkdown, SUBJECT, LEVEL, openrouterKey, mistralKey);

  process.stderr.write(`[3/3] Assemblage de la note...\n`);
  const now = new Date();
  const dateCours = now.toISOString().split('T')[0];
  const dateIngestion = now.toISOString();

  const note = buildNote(structuredContent, {
    subject: SUBJECT,
    level: LEVEL,
    dateCours,
    dateIngestion,
    sources: [sourceName],
  });

  process.stdout.write(note);
}

main().catch((err) => {
  console.error('Erreur pipeline :', err.message);
  process.exit(1);
});
