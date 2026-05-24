// frontend/src/components/ConfirmModal.jsx
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Modal de confirmation générique.
 *
 * Props :
 *   title        — titre (string)
 *   message      — corps du message (string ou JSX)
 *   confirmLabel — texte du bouton de confirmation (défaut : "Supprimer")
 *   onConfirm    — callback quand l'utilisateur confirme
 *   onCancel     — callback quand l'utilisateur annule / ferme
 *   danger       — bool, colore le bouton en rouge (défaut : true)
 */
export default function ConfirmModal({
  title        = 'Confirmer',
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
  onCancel,
  danger       = true,
}) {
  const cancelRef = useRef(null);

  // Focus sur "Annuler" à l'ouverture (safe default)
  useEffect(() => { cancelRef.current?.focus(); }, []);

  // Fermer sur Échap
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={e => { e.stopPropagation(); onCancel(); }}
        aria-hidden
      />

      {/* Boîte — bottom sheet sur mobile, modal centrée sur desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="fixed z-[9999]
          bottom-0 left-0 right-0 w-full h-auto
          md:bottom-auto md:left-1/2 md:top-1/2 md:right-auto
          md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(92vw,360px)]
          bg-white dark:bg-neutral-900 shadow-2xl
          rounded-t-2xl md:rounded-2xl
          border-t border-black/[0.07] dark:border-white/[0.08] md:border
          p-6 flex flex-col gap-4
          animate-slide-up md:animate-scale-in"
      >
        {/* Icône + titre */}
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30
            flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-500" />
          </span>
          <div className="min-w-0">
            <p id="confirm-title" className="text-sm font-semibold text-text-primary">
              {title}
            </p>
            {message && (
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Boutons */}
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium
              bg-black/[0.05] dark:bg-white/[0.07]
              text-text-secondary hover:text-text-primary
              hover:bg-black/[0.09] dark:hover:bg-white/[0.12]
              transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={[
              'px-4 py-2 rounded-lg text-xs font-semibold transition',
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm'
                : 'bg-accent hover:bg-accent/90 text-white shadow-sm',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
