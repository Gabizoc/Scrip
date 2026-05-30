async function request(method, path, body, isMultipart = false) {
  const opts = { method, headers: {} };

  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }

  const res = await fetch(`/api${path}`, opts);

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export const api = {
  getNotes:       ()           => request('GET',    '/notes'),
  getNote:        (id)         => request('GET',    `/notes/${encodeURIComponent(id)}`),
  patchNote:      (id, md)     => request('PATCH',  `/notes/${encodeURIComponent(id)}`, { markdown: md }),
  patchNoteMeta:  (id, data)   => request('PATCH',  `/notes/${encodeURIComponent(id)}`, data),
  createNote:     (data)       => request('POST',   '/notes', data),
  deleteNote:     (id)         => request('DELETE', `/notes/${encodeURIComponent(id)}`),
  getNoteSources: (id)         => request('GET',    `/notes/${encodeURIComponent(id)}/sources`),
  searchNotes:    (q)          => request('GET',    `/notes/search?q=${encodeURIComponent(q)}`),

  getTrash:        ()   => request('GET',    '/trash'),
  restoreNote:     (id) => request('POST',   `/trash/${encodeURIComponent(id)}/restore`),
  deleteTrashItem: (id) => request('DELETE', `/trash/${encodeURIComponent(id)}`),
  emptyTrash:      ()   => request('DELETE', '/trash'),

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
  ingestEvents: (jobId) => new EventSource(`/api/ingest/${jobId}/events`),

  getLevels:   ()           => request('GET',    '/levels'),
  createLevel: (name)       => request('POST',   '/levels', { name }),
  patchLevel:  (id, name)   => request('PATCH',  `/levels/${encodeURIComponent(id)}`, { name }),
  deleteLevel: (id)         => request('DELETE', `/levels/${encodeURIComponent(id)}`),

  getPrompts: () => request('GET', '/prompts'),

  getSubjects:      (levelId) => request('GET',    `/subjects${levelId ? `?levelId=${levelId}` : ''}`),
  getSubjectFolders:(id)     => request('GET',    `/subjects/${encodeURIComponent(id)}/folders`),
  createSubject:    (data)   => request('POST',   '/subjects', data),
  patchSubject:     (id, data)=> request('PATCH', `/subjects/${encodeURIComponent(id)}`, data),
  deleteSubject:    (id)     => request('DELETE', `/subjects/${encodeURIComponent(id)}`),

  getSettings: ()     => request('GET', '/settings'),
  putSettings: (data) => request('PUT', '/settings', data),
};
