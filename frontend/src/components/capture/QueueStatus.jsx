import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CloudOff, Loader2, Trash2, Clock } from 'lucide-react';
import { api } from '../../lib/api.js';
import { listQueuedCaptures, onQueueChange, removeQueuedCapture } from '../../lib/offlineQueue.js';
import GlassCard from '../GlassCard.jsx';

function useQueuedCaptures() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = () => listQueuedCaptures().then(setItems);
    load();
    return onQueueChange(load);
  }, []);
  return items;
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Captures en attente : envoyées hors ligne (navigateur) et analyses en cours (serveur).
export default function QueueStatus({ currentJobId, onFollow }) {
  const offline = useQueuedCaptures();
  const { data: jobs = [] } = useQuery({
    queryKey: ['ingest-jobs'],
    queryFn: api.getIngestJobs,
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 5000 : false),
    retry: false,
  });

  const serverJobs = jobs.filter(j => j.id !== currentJobId);
  if (offline.length === 0 && serverJobs.length === 0) return null;

  return (
    <GlassCard className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">File d'attente</h3>

      {offline.map(item => (
        <div key={item.id} className="flex items-start gap-3">
          <CloudOff size={16} className={item.lastError ? 'text-status-danger mt-0.5' : 'text-text-tertiary mt-0.5'} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-text-primary">
              {item.files.length} page{item.files.length > 1 ? 's' : ''} · capturée{item.files.length > 1 ? 's' : ''} à {formatTime(item.createdAt)}
            </p>
            <p className={['text-[11px]', item.lastError ? 'text-status-danger' : 'text-text-tertiary'].join(' ')}>
              {item.lastError ? `Refusée par le serveur : ${item.lastError}` : 'Hors ligne — sera envoyée au retour du réseau'}
            </p>
          </div>
          <button
            onClick={() => removeQueuedCapture(item.id)}
            className="text-text-tertiary hover:text-status-danger transition-colors"
            aria-label="Supprimer cette capture"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {serverJobs.map(job => (
        <div key={job.id} className="flex items-center gap-3">
          {job.status === 'running'
            ? <Loader2 size={16} className="text-accent animate-spin" />
            : <Clock size={16} className="text-text-tertiary" />}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-text-primary truncate">
              {job.subject ?? 'Cours'} · {job.pages} page{job.pages > 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-text-tertiary">
              {job.status === 'running' ? 'Analyse en cours' : 'En attente'} · envoyée à {formatTime(job.createdAt)}
            </p>
          </div>
          {onFollow && (
            <button onClick={() => onFollow(job.id)} className="text-[12px] text-accent hover:underline">
              Suivre
            </button>
          )}
        </div>
      ))}
    </GlassCard>
  );
}
