import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  listQueuedCaptures, removeQueuedCapture, markQueuedCaptureFailed, queuedFiles, isNetworkError,
} from '../lib/offlineQueue.js';

let syncing = false;

// Envoie les captures faites hors ligne. Une erreur réseau arrête la synchro (nouvel essai
// au prochain retour en ligne) ; une erreur de l'API est notée sur la capture, qui reste
// dans la file jusqu'à ce que l'utilisateur la supprime.
export async function syncOfflineCaptures() {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let sent = 0;
  try {
    for (const item of await listQueuedCaptures()) {
      if (item.lastError) continue;
      try {
        await api.ingest(queuedFiles(item), item.subjectId, item.levelId, item.userNote, item.subfolder);
        await removeQueuedCapture(item.id);
        sent++;
      } catch (err) {
        if (isNetworkError(err)) break;
        await markQueuedCaptureFailed(item, err.message);
      }
    }
  } finally {
    syncing = false;
  }
  return sent;
}

export function useOfflineSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const run = async () => {
      const sent = await syncOfflineCaptures();
      if (sent > 0) qc.invalidateQueries({ queryKey: ['ingest-jobs'] });
    };
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [qc]);
}
