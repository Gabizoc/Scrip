import { log } from '../lib/logger.js';
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
    log.debug(`[debug] log sauvegardé → ${file}`);
    return file;
  } catch (err) {
    log.warn(`[debug] échec sauvegarde log: ${err.message}`);
    return null;
  }
}
