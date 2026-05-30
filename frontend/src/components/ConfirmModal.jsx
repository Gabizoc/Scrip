import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({
  title        = 'Confirmer',
  message,
  confirmLabel = 'Supprimer',
  onConfirm,
  onCancel,
  danger       = true,
}) {
  const cancelRef = useRef(null);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px] animate-fade-in"
        aria-hidden
      />

      <div className="modal-wrapper" onClick={e => { e.stopPropagation(); onCancel(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={e => e.stopPropagation()}
        className="modal-sheet-sm
          bg-white dark:bg-neutral-900 shadow-2xl
          border border-black/[0.07] dark:border-white/[0.08]
          p-6 flex flex-col gap-4"
      >
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
      </div>
    </>,
    document.body,
  );
}
