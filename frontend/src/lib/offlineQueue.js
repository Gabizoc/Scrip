// File d'attente des captures faites hors ligne, stockée dans IndexedDB (les photos
// sont conservées en Blob). Elles sont envoyées au serveur au retour du réseau.

const DB_NAME = 'scrip-offline';
const STORE = 'captures';
const CHANGE_EVENT = 'scrip:offline-queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result ?? result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onQueueChange(fn) {
  window.addEventListener(CHANGE_EVENT, fn);
  return () => window.removeEventListener(CHANGE_EVENT, fn);
}

export async function enqueueCapture({ files, subjectId, levelId, userNote, subfolder }) {
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    // File → { name, type, blob } : un File n'est pas toujours stockable tel quel (Safari).
    files: files.map(f => ({ name: f.name, type: f.type, blob: new Blob([f], { type: f.type }) })),
    subjectId,
    levelId: levelId ?? null,
    userNote: userNote ?? '',
    subfolder: subfolder ?? '',
  };
  await withStore('readwrite', store => store.put(item));
  notifyChange();
  return item.id;
}

export async function listQueuedCaptures() {
  try {
    return await withStore('readonly', store => store.getAll());
  } catch {
    return [];
  }
}

// Garde la capture mais note pourquoi le serveur l'a refusée (affiché à l'utilisateur).
export async function markQueuedCaptureFailed(item, message) {
  await withStore('readwrite', store => store.put({ ...item, lastError: message }));
  notifyChange();
}

export async function removeQueuedCapture(id) {
  await withStore('readwrite', store => store.delete(id));
  notifyChange();
}

export function queuedFiles(item) {
  return item.files.map(f => new File([f.blob], f.name, { type: f.type }));
}

// Une erreur réseau (serveur injoignable) se distingue d'une erreur renvoyée par l'API.
export function isNetworkError(err) {
  return !navigator.onLine || err instanceof TypeError;
}
