// backend/src/trash.js
//
// Corbeille : la suppression d'une note ne l'efface pas définitivement.
// Les fichiers (markdown, audit, photos sources) sont déplacés dans
// <vault>/.trash/<noteId>/ et l'enregistrement passe de db.data.notes à
// db.data.trash avec un horodatage deletedAt. Une purge automatique supprime
// définitivement les entrées plus vieilles que settings.trashRetentionDays.

import fs from 'node:fs';
import path from 'node:path';
import { db, resolveVaultPath } from './db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function trashRoot() {
  return path.join(resolveVaultPath(db.data.settings.vaultPath), '.trash');
}

// Déplace un fichier ou dossier, en créant le dossier parent si besoin.
// Fallback copie+suppression si rename échoue entre deux systèmes de fichiers.
function movePath(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code === 'EXDEV') {
      fs.cpSync(from, to, { recursive: true });
      fs.rmSync(from, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

/**
 * Déplace les fichiers d'une note vers la corbeille et retourne l'entrée à
 * stocker dans db.data.trash. Ne touche pas à la db (le caller s'en charge).
 */
export function buildTrashEntry(note) {
  const dir = path.join(trashRoot(), note.id);
  fs.mkdirSync(dir, { recursive: true });

  const files = {};

  if (note.path && fs.existsSync(note.path)) {
    const to = path.join(dir, path.basename(note.path));
    movePath(note.path, to);
    files.note = { from: note.path, to };
  }

  if (note.auditPath && fs.existsSync(note.auditPath)) {
    const to = path.join(dir, path.basename(note.auditPath));
    movePath(note.auditPath, to);
    files.audit = { from: note.auditPath, to };
  }

  if (note.sourcePaths?.length) {
    const srcDir = path.dirname(note.sourcePaths[0]);
    if (fs.existsSync(srcDir)) {
      const to = path.join(dir, '_sources');
      movePath(srcDir, to);
      files.sources = { from: srcDir, to };
    }
  }

  return {
    id: note.id,
    note,
    deletedAt: new Date().toISOString(),
    trashDir: dir,
    files,
  };
}

/**
 * Restaure les fichiers d'une entrée corbeille vers leurs emplacements
 * d'origine, puis supprime le dossier corbeille. Lève une erreur si un
 * emplacement d'origine est déjà occupé (conflit).
 */
export function restoreTrashFiles(entry) {
  const files = entry.files ?? {};
  for (const key of ['note', 'audit', 'sources']) {
    const f = files[key];
    if (!f) continue;
    if (fs.existsSync(f.from)) {
      throw new Error(`Restauration impossible : « ${path.basename(f.from)} » existe déjà à son emplacement d'origine`);
    }
  }
  for (const key of ['note', 'audit', 'sources']) {
    const f = files[key];
    if (!f || !fs.existsSync(f.to)) continue;
    movePath(f.to, f.from);
  }
  if (entry.trashDir && fs.existsSync(entry.trashDir)) {
    fs.rmSync(entry.trashDir, { recursive: true, force: true });
  }
}

/** Supprime définitivement les fichiers d'une entrée corbeille. */
export function deleteTrashFiles(entry) {
  if (entry.trashDir && fs.existsSync(entry.trashDir)) {
    fs.rmSync(entry.trashDir, { recursive: true, force: true });
  }
}

/**
 * Supprime définitivement les entrées corbeille plus vieilles que
 * settings.trashRetentionDays. Retourne le nombre d'entrées purgées.
 */
export async function purgeExpiredTrash() {
  await db.read();
  const days = Number(db.data.settings.trashRetentionDays ?? 30);
  if (!Number.isFinite(days) || days <= 0) return 0;

  const cutoff  = Date.now() - days * DAY_MS;
  const trash   = db.data.trash ?? [];
  const expired = trash.filter(e => new Date(e.deletedAt).getTime() < cutoff);
  if (expired.length === 0) return 0;

  for (const entry of expired) deleteTrashFiles(entry);
  db.data.trash = trash.filter(e => !expired.includes(e));
  await db.write();
  return expired.length;
}
