#!/usr/bin/env node
// ingest.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { runOCR } from './src/ocr.js';
import { structureContent } from './src/structure.js';
import { buildNote } from './src/format.js';
import { writeAuditLog } from './src/audit.js';

const SUBJECT = process.env.SCRIP_SUBJECT ?? 'histoire';
const LEVEL = process.env.SCRIP_LEVEL ?? '1ère';

function nextAvailablePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let n = 1;
  while (fs.existsSync(path.join(dir, `${base} (${n})${ext}`))) n++;
  return path.join(dir, `${base} (${n})${ext}`);
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function sanitizeFilename(name) {
  return name
    .replace(/[—–]/g, '-')
    .replace(/[/\\:*?"<>|]/g, '-')
    .trim();
}

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
  const { rawMarkdown, imageRegions } = await runOCR(absolutePath, mistralKey);

  process.stderr.write(`[2/3] Structuration via LLM (${SUBJECT})...\n`);
  const structured = await structureContent(rawMarkdown, SUBJECT, LEVEL, openrouterKey, mistralKey);

  process.stderr.write(`[3/3] Assemblage de la note...\n`);
  const now = new Date();
  const dateCours = now.toISOString().split('T')[0];
  const dateIngestion = now.toISOString();

  const note = buildNote(structured, {
    subject: SUBJECT,
    level: LEVEL,
    dateCours,
    dateIngestion,
    sources: [sourceName],
  });

  const title = extractTitle(structured);
  const baseName = sanitizeFilename(title ?? path.basename(imagePath, path.extname(imagePath)));
  const notePath = nextAvailablePath(`${baseName}.md`);
  fs.writeFileSync(notePath, note);
  process.stderr.write(`[note] ${notePath}\n`);

  const auditPath = writeAuditLog(structured, imageRegions, sourceName, dateIngestion);
  if (auditPath) {
    process.stderr.write(`[audit] ${auditPath}\n`);
  }
}

main().catch((err) => {
  console.error('Erreur pipeline :', err.message);
  process.exit(1);
});
