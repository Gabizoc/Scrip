// backend/src/pipeline/debug-log.js
//
// Sauvegarde les données de debug du pipeline dans vault/_debug/<timestamp>.json
// Activé si DEBUG_PIPELINE=true dans le .env (ou toujours si hallucination détectée)

import fs from 'node:fs';
import path from 'node:path';

export function saveDebugLog(vaultPath, data) {
  try {
    const debugDir = path.join(vaultPath, '_debug');
    fs.mkdirSync(debugDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(debugDir, `${ts}.json`);

    const payload = {
      timestamp: new Date().toISOString(),
      ...data,
    };

    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    process.stderr.write(`[debug] log sauvegardé → ${file}\n`);
    return file;
  } catch (err) {
    process.stderr.write(`[debug] échec sauvegarde log: ${err.message}\n`);
    return null;
  }
}
