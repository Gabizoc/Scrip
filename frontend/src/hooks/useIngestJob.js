import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

// Suit la progression d'une ingestion côté serveur (flux SSE). Le serveur rejoue les étapes
// déjà franchies à chaque connexion : on peut donc se rattacher à une tâche en cours, et
// laisser EventSource se reconnecter seul après une coupure.
export function useIngestJob(jobId, { onDone } = {}) {
  const [steps, setSteps] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    setSteps([]);
    setWarnings([]);
    setError(null);

    const es = api.ingestEvents(jobId);

    es.addEventListener('open', () => setWarnings([]));

    es.addEventListener('step', (e) => {
      const step = JSON.parse(e.data);
      setSteps(prev => {
        const idx = prev.findIndex(s => s.id === step.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = step; return next; }
        return [...prev, step];
      });
    });

    es.addEventListener('warning', (e) => {
      const w = JSON.parse(e.data);
      setWarnings(prev => [...prev, w]);
    });

    es.addEventListener('done', (e) => {
      es.close();
      onDone?.(JSON.parse(e.data));
    });

    es.addEventListener('error', (e) => {
      // Événement "error" envoyé par le serveur : la tâche a échoué.
      if (e.data) {
        es.close();
        try { setError(JSON.parse(e.data).message); } catch { setError('Erreur inconnue'); }
        return;
      }
      // Erreur de connexion : EventSource retente seul tant qu'il n'est pas fermé.
      if (es.readyState === EventSource.CLOSED) setError('Connexion au serveur perdue');
    });

    return () => es.close();
    // onDone volontairement exclu : seul le changement de tâche doit relancer l'abonnement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return { steps, warnings, error };
}
