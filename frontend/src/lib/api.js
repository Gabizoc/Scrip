// frontend/src/lib/api.js

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
  getNotes:   ()           => request('GET',    '/notes'),
  getNote:    (id)         => request('GET',    `/notes/${id}`),
  patchNote:  (id, md)     => request('PATCH',  `/notes/${id}`, { markdown: md }),
  deleteNote: (id)         => request('DELETE', `/notes/${id}`),

  // ── Ingest ─────────────────────────────────────────────
  ingest: (photo, subjectId, levelId) => {
    const fd = new FormData();
    fd.append('photo', photo);
    fd.append('subjectId', subjectId);
    if (levelId) fd.append('levelId', levelId);
    return request('POST', '/ingest', fd, true);
  },

  // ── Levels ─────────────────────────────────────────────
  getLevels:   ()           => request('GET',    '/levels'),
  createLevel: (name)       => request('POST',   '/levels', { name }),
  patchLevel:  (id, name)   => request('PATCH',  `/levels/${id}`, { name }),
  deleteLevel: (id)         => request('DELETE', `/levels/${id}`),

  // ── Subjects ───────────────────────────────────────────
  getSubjects:   (levelId) => request('GET',    `/subjects${levelId ? `?levelId=${levelId}` : ''}`),
  createSubject: (data)    => request('POST',   '/subjects', data),
  patchSubject:  (id, data)=> request('PATCH',  `/subjects/${id}`, data),
  deleteSubject: (id)      => request('DELETE', `/subjects/${id}`),

  // ── Settings ───────────────────────────────────────────
  getSettings: ()     => request('GET', '/settings'),
  putSettings: (data) => request('PUT', '/settings', data),
};
