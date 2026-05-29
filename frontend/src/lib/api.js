
/**
 * Client HTTP vers l'API backend.
 * Toutes les fonctions sont des async qui throw en cas d'erreur HTTP.
 */

async function request(method, path, body, isMultipart = false) {
  const opts = { method, headers: {} };

  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body; // FormData — pas de Content-Type manuel
  }

  const res = await fetch(`/api${path}`, opts);

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export const api = {
  // ── Notes ──────────────────────────────────────────────
  getNotes:       ()           => request('GET',    '/notes'),
  getNote:        (id)         => request('GET',    `/notes/${id}`),
  patchNote:      (id, md)     => request('PATCH',  `/notes/${id}`, { markdown: md }),
  patchNoteMeta:  (id, data)   => request('PATCH',  `/notes/${id}`, data),
  createNote:     (data)       => request('POST',   '/notes', data),
  deleteNote:     (id)         => request('DELETE', `/notes/${id}`),
  getNoteSources: (id)         => request('GET',    `/notes/${id}/sources`),
  searchNotes:    (q)          => request('GET',    `/notes/search?q=${encodeURIComponent(q)}`),

  // ── Corbeille ──────────────────────────────────────────
  getTrash:        ()   => request('GET',    '/trash'),
  restoreNote:     (id) => request('POST',   `/trash/${id}/restore`),
  deleteTrashItem: (id) => request('DELETE', `/trash/${id}`),
  emptyTrash:      ()   => request('DELETE', '/trash'),

  // ── Ingest ─────────────────────────────────────────────
  /** Démarre l'ingestion, retourne { jobId } */
  ingest: (photos, subjectId, levelId, userNote, subfolder) => {
    const fd = new FormData();
    const files = Array.isArray(photos) ? photos : [photos];
    files.forEach(f => fd.append('photos', f));
    fd.append('subjectId', subjectId);
    if (levelId)           fd.append('levelId',   levelId);
    if (userNote?.trim())  fd.append('userNote',  userNote.trim());
    if (subfolder?.trim()) fd.append('subfolder', subfolder.trim());
    return request('POST', '/ingest', fd, true);
  },
  /** Ouvre un flux SSE pour suivre la progression d'un job */
  ingestEvents: (jobId) => new EventSource(`/api/ingest/${jobId}/events`),

  // ── Levels ─────────────────────────────────────────────
  getLevels:   ()           => request('GET',    '/levels'),
  createLevel: (name)       => request('POST',   '/levels', { name }),
  patchLevel:  (id, name)   => request('PATCH',  `/levels/${id}`, { name }),
  deleteLevel: (id)         => request('DELETE', `/levels/${id}`),

  // ── Subjects ───────────────────────────────────────────
  getSubjects:      (levelId) => request('GET',    `/subjects${levelId ? `?levelId=${levelId}` : ''}`),
  getSubjectFolders:(id)     => request('GET',    `/subjects/${id}/folders`),
  createSubject:    (data)   => request('POST',   '/subjects', data),
  patchSubject:     (id, data)=> request('PATCH', `/subjects/${id}`, data),
  deleteSubject:    (id)     => request('DELETE', `/subjects/${id}`),

  // ── Settings ───────────────────────────────────────────
  getSettings: ()     => request('GET', '/settings'),
  putSettings: (data) => request('PUT', '/settings', data),
};
