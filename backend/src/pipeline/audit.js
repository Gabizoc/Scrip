// src/audit.js
import fs from 'node:fs';
import path from 'node:path';

const CORRECTION_RE = /\[Note\s*:\s*"([^"]+)"\s+corrigé\s+en\s+"([^"]+)"\s*[—–-]\s*([^\]]+)\]/gu;

function nextAvailablePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let n = 1;
  while (fs.existsSync(path.join(dir, `${base} (${n})${ext}`))) n++;
  return path.join(dir, `${base} (${n})${ext}`);
}

/**
 * Parse les corrections factuelles tracées du contenu LLM.
 * @param {string} content
 * @returns {Array<{ original: string, corrected: string, reason: string }>}
 */
export function parseCorrections(content) {
  const results = [];
  let match;
  const re = new RegExp(CORRECTION_RE.source, CORRECTION_RE.flags);
  while ((match = re.exec(content)) !== null) {
    results.push({
      original: match[1],
      corrected: match[2],
      reason: match[3].trim(),
    });
  }
  return results;
}

/**
 * Crée le fichier d'audit si des corrections factuelles ou des régions non-textuelles existent.
 * @param {string} structuredContent - Sortie LLM complète
 * @param {Array<{id:string, x1:number, y1:number, x2:number, y2:number}>} imageRegions
 * @param {string} sourceName - Nom du fichier source (ex: 'IMG_2406.jpeg')
 * @param {string} dateIngestion - ISO timestamp
 * @returns {string|null} Chemin du fichier créé, ou null si non nécessaire
 */
export function writeAuditLog(structuredContent, imageRegions, sourceName, dateIngestion, auditDir = '_audit') {
  const corrections = parseCorrections(structuredContent);
  if (corrections.length === 0 && imageRegions.length === 0) return null;

  const baseName = path.basename(sourceName, path.extname(sourceName));
  fs.mkdirSync(auditDir, { recursive: true });
  const auditPath = nextAvailablePath(path.join(auditDir, `${baseName}.audit.md`));

  const lines = [
    `# Audit — ${baseName}`,
    '',
    `**Date d'ingestion** : ${dateIngestion}`,
    `**Modèle OCR** : Mistral OCR (free)`,
    `**Modèle structuration** : mistral-small-latest`,
    '',
  ];

  if (corrections.length > 0) {
    lines.push('## Corrections factuelles appliquées', '');
    lines.push('| Original (OCR) | Corrigé | Raison |');
    lines.push('|----------------|---------|--------|');
    for (const c of corrections) {
      lines.push(`| "${c.original}" | "${c.corrected}" | ${c.reason} |`);
    }
    lines.push('');
  }

  if (imageRegions.length > 0) {
    lines.push('## Zones non-textuelles détectées', '');
    imageRegions.forEach((r, i) => {
      lines.push(`- Schéma ${i + 1} : \`${r.id}\` — bounding box (${r.x1}, ${r.y1}, ${r.x2}, ${r.y2})`);
    });
    lines.push('');
  }

  fs.writeFileSync(auditPath, lines.join('\n'));
  return auditPath;
}

/**
 * Extrait le bloc METADATA HTML commenté de la sortie LLM.
 * @param {string} content - Contenu structuré du LLM
 * @returns {Object|null} Objet avec les champs METADATA, ou null si absent
 */
export function parseMetadata(content) {
  const match = content.match(/<!--\s*METADATA\s*([\s\S]*?)-->/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].trim().split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    const num = Number(val);
    result[key] = isNaN(num) || val === '' ? val : num;
  }
  return result;
}
