import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { subjectDotColor, subjectIcon } from '../lib/noteUtils.js';

/**
 * Popover inline pour éditer la matière d'une note.
 *
 * Props :
 *   note        — objet note (id, subject)
 *   triggerRect — DOMRect du badge déclencheur (getBoundingClientRect())
 *   onClose     — callback de fermeture
 */
export default function SubjectEditor({ note, triggerRect, onClose }) {
  const qc = useQueryClient();
  const [value, setValue]   = useState(note.subject ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef  = useRef(null);
  const popoverRef = useRef(null);

  // Récupère la liste des matières existantes
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn:  () => api.getSubjects(),
  });

  // Focus au montage
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Fermer sur clic extérieur
  useEffect(() => {
    function handler(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  async function save(name) {
    const trimmed = (name ?? value).trim();
    if (!trimmed) { onClose(); return; }
    if (trimmed === note.subject) { onClose(); return; }
    setSaving(true);
    try {
      await api.patchNoteMeta(note.id, { subject: trimmed });
      qc.invalidateQueries({ queryKey: ['notes'] });
    } finally {
      onClose();
    }
  }

  // Positionner sous le badge, recalé si hors écran à droite
  const left = Math.min(triggerRect.left, window.innerWidth - 216);
  const top  = triggerRect.bottom + 6;

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top, left, zIndex: 9999, width: 208 }}
      className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl
        border border-black/[0.08] dark:border-white/[0.1] p-2.5 space-y-2"
    >
      {/* Input + bouton confirmer */}
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); save(); }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Matière…"
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg
            bg-black/[0.04] dark:bg-white/[0.06]
            text-text-primary placeholder:text-text-tertiary
            focus:outline-none focus:ring-2 focus:ring-accent/30 transition"
        />
        <button
          onClick={() => save()}
          disabled={saving}
          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-accent text-white text-xs font-medium
            hover:bg-accent/90 disabled:opacity-50 transition flex items-center gap-1"
        >
          <Check size={11} />
        </button>
      </div>

      {/* Matières existantes */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => save(s.name)}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition
                bg-black/[0.04] dark:bg-white/[0.06]
                hover:bg-accent/10 dark:hover:bg-accent/20
                text-text-secondary hover:text-accent"
            >
              <span
                className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                style={{ background: subjectDotColor(s.name, s.color ?? null) }}
              />
              {subjectIcon(s.name)} {s.name}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
