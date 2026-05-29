// frontend/src/pages/Settings/Trash.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import GlassCard from '../../components/GlassCard.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

function daysLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Trash() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [confirmEmpty, setConfirmEmpty]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, title }

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: items = [], isLoading } = useQuery({ queryKey: ['trash'], queryFn: api.getTrash });

  const retention = settings?.trashRetentionDays ?? 30;

  const updateSettings = useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const restore = useMutation({
    mutationFn: api.restoreNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (e) => alert(e.message),
  });

  const removeOne = useMutation({
    mutationFn: api.deleteTrashItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
    onError: (e) => alert(e.message),
  });

  const empty = useMutation({
    mutationFn: api.emptyTrash,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash'] }),
    onError: (e) => alert(e.message),
  });

  function saveRetention(e) {
    const n = parseInt(e.target.value, 10);
    if (Number.isFinite(n) && n > 0 && n !== retention) {
      updateSettings.mutate({ trashRetentionDays: n });
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Paramètres
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Corbeille</h1>

      <div className="space-y-3">
        {/* Réglage de purge automatique */}
        <GlassCard className="p-4 space-y-2">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Purge automatique</h3>
          <div className="flex items-center gap-3">
            <span className="text-[15px] text-text-primary">Supprimer définitivement après</span>
            <input
              type="number"
              min="1"
              key={retention}
              defaultValue={retention}
              onBlur={saveRetention}
              className="w-16 h-10 px-3 rounded-md text-center text-[15px]
                bg-black/[0.03] dark:bg-white/[0.04]
                border border-black/[0.08] dark:border-white/[0.06]
                text-text-primary focus:outline-none focus:border-accent/50"
            />
            <span className="text-[15px] text-text-secondary">jours</span>
          </div>
        </GlassCard>

        {/* Liste */}
        {isLoading && (
          <p className="text-text-tertiary text-sm text-center py-6">Chargement…</p>
        )}

        {!isLoading && items.length === 0 && (
          <p className="text-text-tertiary text-sm text-center py-10">La corbeille est vide.</p>
        )}

        {items.map(item => {
          const left = daysLeft(item.expiresAt);
          return (
            <GlassCard key={item.id} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-text-primary truncate">{item.title}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  {[item.subject, item.level].filter(Boolean).join(' · ')}
                  {(item.subject || item.level) ? ' — ' : ''}
                  supprimé le {formatDate(item.deletedAt)} · purge dans {left} j
                </p>
              </div>
              <button
                onClick={() => restore.mutate(item.id)}
                disabled={restore.isPending}
                className="flex-shrink-0 text-accent p-1.5 hover:opacity-70 transition-opacity disabled:opacity-40"
                aria-label={`Restaurer ${item.title}`}
                title="Restaurer"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setConfirmDelete({ id: item.id, title: item.title })}
                className="flex-shrink-0 text-status-danger p-1.5 hover:opacity-70 transition-opacity"
                aria-label={`Supprimer définitivement ${item.title}`}
                title="Supprimer définitivement"
              >
                <Trash2 size={16} />
              </button>
            </GlassCard>
          );
        })}

        {/* Vider la corbeille */}
        {items.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-medium
              text-status-danger bg-status-danger/[0.08] hover:bg-status-danger/[0.14] transition-colors"
          >
            <Trash2 size={14} />
            Vider la corbeille ({items.length})
          </button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Supprimer définitivement ?"
          message={`« ${confirmDelete.title} » sera supprimé définitivement, sans possibilité de restauration.`}
          confirmLabel="Supprimer"
          onConfirm={() => { removeOne.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmEmpty && (
        <ConfirmModal
          title="Vider la corbeille ?"
          message={`Les ${items.length} note(s) de la corbeille seront supprimées définitivement.`}
          confirmLabel="Tout supprimer"
          onConfirm={() => { empty.mutate(); setConfirmEmpty(false); }}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  );
}
