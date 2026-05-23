// frontend/src/pages/Capture.jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Plus, X, FileImage, CheckCircle, Circle, XCircle, Loader2, Scan, BrainCircuit, Wand2, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCamera } from '../hooks/useCamera.jsx';
import Button from '../components/Button.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Dropdown from '../components/Dropdown.jsx';

// Définition des étapes dans l'ordre
const PIPELINE_STEPS = [
  { id: 'ocr',       label: 'Lecture des notes',      icon: Scan },
  { id: 'structure', label: 'Structuration du contenu', icon: BrainCircuit },
  { id: 'format',    label: 'Mise en forme',           icon: Wand2 },
  { id: 'save',      label: 'Sauvegarde de la note',   icon: Save },
];

function ElapsedBadge({ ms }) {
  if (ms == null) return null;
  const s = (ms / 1000).toFixed(1);
  return (
    <span className="text-[10px] font-mono tabular-nums text-text-tertiary bg-black/[0.05] dark:bg-white/[0.07] px-1.5 py-0.5 rounded shrink-0">
      {s}s
    </span>
  );
}

function ProgressPanel({ steps, warnings = [], error }) {
  // Timings client-side
  const [timings, setTimings] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const tickRef  = useRef(null);

  // Timer global
  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(tickRef.current);
  }, []);

  // Enregistre start/end par step
  useEffect(() => {
    setTimings(prev => {
      const next = { ...prev };
      steps.forEach(step => {
        if (step.status === 'running' && !next[step.id]?.start) {
          next[step.id] = { start: Date.now() };
        }
        if (step.status === 'done' && next[step.id]?.start && !next[step.id]?.end) {
          next[step.id] = { ...next[step.id], end: Date.now() };
        }
      });
      return next;
    });
  }, [steps]);

  const doneCount    = PIPELINE_STEPS.filter(def => steps.find(s => s.id === def.id)?.status === 'done').length;
  const progressPct  = Math.round((doneCount / PIPELINE_STEPS.length) * 100);
  const runningStep  = PIPELINE_STEPS.find(def => steps.find(s => s.id === def.id)?.status === 'running');

  // Log des détails reçus
  const logEntries = steps
    .filter(s => s.detail)
    .map(s => ({ id: s.id, label: s.label ?? PIPELINE_STEPS.find(d => d.id === s.id)?.label, detail: s.detail, status: s.status }));

  return (
    <GlassCard className="overflow-hidden">
      {/* Header avec timer global */}
      <div className="px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-75" />
              <span className="relative block w-2 h-2 rounded-full bg-accent" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              {runningStep
                ? (steps.find(s => s.id === runningStep.id)?.label ?? runningStep.label)
                : doneCount === PIPELINE_STEPS.length ? 'Terminé' : 'En attente…'}
            </p>
          </div>
          <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
            {(elapsed / 1000).toFixed(1)}s
          </span>
        </div>

        {/* Barre de progression globale segmentée */}
        <div className="flex gap-1">
          {PIPELINE_STEPS.map((def, i) => {
            const s = steps.find(st => st.id === def.id);
            const status = s?.status ?? 'pending';
            return (
              <div key={def.id} className="flex-1 h-1.5 rounded-full overflow-hidden bg-black/[0.07] dark:bg-white/[0.08]">
                {status === 'done' && (
                  <div className="h-full w-full rounded-full bg-accent/80" />
                )}
                {status === 'running' && (
                  <div className="h-full w-full rounded-full bg-accent
                    animate-[pulse_1s_ease-in-out_infinite]" />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-text-tertiary mt-1.5">
          Étape {Math.min(doneCount + (runningStep ? 1 : 0), PIPELINE_STEPS.length)} / {PIPELINE_STEPS.length}
        </p>
      </div>

      {/* Steps */}
      <div className="px-5 py-4 space-y-3">
        {PIPELINE_STEPS.map((def) => {
          const step    = steps.find(s => s.id === def.id);
          const status  = step?.status ?? 'pending';
          const label   = step?.label ?? def.label;
          const t       = timings[def.id];
          const durMs   = t?.end ? t.end - t.start : null;
          const Icon    = def.icon;

          return (
            <div key={def.id} className={[
              'flex items-start gap-3 transition-all duration-300',
              status === 'pending' ? 'opacity-35' : '',
            ].join(' ')}>
              {/* Icône statut */}
              <div className={[
                'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-px transition-all duration-300',
                status === 'done'    ? 'bg-status-success/15'  :
                status === 'running' ? 'bg-accent/15'           :
                status === 'error'   ? 'bg-status-danger/15'   :
                'bg-black/[0.05] dark:bg-white/[0.05]',
              ].join(' ')}>
                {status === 'running' ? (
                  <Loader2 size={14} className="text-accent animate-spin" />
                ) : status === 'done' ? (
                  <CheckCircle size={14} className="text-status-success" />
                ) : status === 'error' ? (
                  <XCircle size={14} className="text-status-danger" />
                ) : (
                  <Icon size={14} className="text-text-tertiary" />
                )}
              </div>

              {/* Texte */}
              <div className="flex-1 min-w-0">
                <p className={[
                  'text-[13px] font-medium transition-colors leading-tight',
                  status === 'done'    ? 'text-text-primary' :
                  status === 'running' ? 'text-accent' :
                  status === 'error'   ? 'text-status-danger' :
                  'text-text-tertiary',
                ].join(' ')}>
                  {label}
                </p>
                {step?.detail && (
                  <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{step.detail}</p>
                )}
                {/* Barre shimmer si running */}
                {status === 'running' && (
                  <div className="mt-1.5 h-0.5 w-28 rounded-full bg-accent/20 overflow-hidden">
                    <div className="h-full rounded-full bg-accent
                      animate-[shimmer_1.4s_ease-in-out_infinite]
                      [background:linear-gradient(90deg,transparent,rgba(124,122,255,0.9),transparent)]
                      [background-size:200%_100%]" />
                  </div>
                )}
              </div>

              {/* Durée */}
              <ElapsedBadge ms={durMs} />
            </div>
          );
        })}
      </div>

      {/* Log des détails */}
      {logEntries.length > 0 && (
        <div className="mx-5 mb-5 rounded-lg bg-black/[0.03] dark:bg-white/[0.03]
          border border-black/[0.05] dark:border-white/[0.05] overflow-hidden">
          <p className="text-[9px] uppercase tracking-widest font-semibold text-text-tertiary
            px-3 pt-2.5 pb-1.5 border-b border-black/[0.05] dark:border-white/[0.05]">
            Activité
          </p>
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {logEntries.map((e, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <span className={[
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  e.status === 'done' ? 'bg-status-success' : 'bg-accent',
                ].join(' ')} />
                <span className="text-[11px] text-text-secondary truncate flex-1">{e.label}</span>
                <span className="text-[11px] text-text-tertiary truncate max-w-[140px]">{e.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mx-5 mb-5 space-y-1.5">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-status-warning bg-status-warning/10 rounded-md px-3 py-2 flex items-start gap-2">
              <span className="shrink-0 mt-px">⚠</span>
              <span>{w.message}</span>
            </p>
          ))}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="mx-5 mb-5">
          <p className="text-sm text-status-danger bg-status-danger/10 rounded-md px-3 py-2">
            {error}
          </p>
        </div>
      )}
    </GlassCard>
  );
}

export default function Capture() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pages, setPages] = useState([]);
  const [subjectId, setSubjectId] = useState('');

  // État du pipeline SSE
  const [processing, setProcessing] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [pipelineError, setPipelineError] = useState(null);
  const [pipelineWarnings, setPipelineWarnings] = useState([]);
  const esRef = useRef(null);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', settings?.currentLevelId],
    queryFn: () => api.getSubjects(settings?.currentLevelId),
    enabled: !!settings?.currentLevelId,
  });

  const addPages = useCallback((files) => {
    setPages(prev => [...prev, ...files.map(file => ({ file, url: URL.createObjectURL(file) }))]);
  }, []);

  const removePage = useCallback((idx) => {
    setPages(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });
  }, []);

  const clearAll = useCallback(() => {
    setPages(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return []; });
  }, []);

  // Ferme le flux SSE si le composant est démonté
  useEffect(() => () => esRef.current?.close(), []);

  const { triggerGallery, CameraInputs } = useCamera({ onCapture: addPages, multiple: true });

  async function startIngest() {
    if (!pages.length || !subjectId) return;

    setProcessing(true);
    setPipelineSteps([]);
    setPipelineError(null);
    setPipelineWarnings([]);

    let jobId;
    try {
      const res = await api.ingest(pages.map(p => p.file), subjectId, settings?.currentLevelId);
      jobId = res.jobId;
    } catch (err) {
      setPipelineError(err.message);
      setProcessing(false);
      return;
    }

    // Connexion SSE
    const es = api.ingestEvents(jobId);
    esRef.current = es;

    es.addEventListener('step', (e) => {
      const step = JSON.parse(e.data);
      setPipelineSteps(prev => {
        const idx = prev.findIndex(s => s.id === step.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = step; return next; }
        return [...prev, step];
      });
    });

    es.addEventListener('done', (e) => {
      es.close();
      const { note } = JSON.parse(e.data);
      pages.forEach(p => URL.revokeObjectURL(p.url));
      qc.invalidateQueries({ queryKey: ['notes'] });
      navigate(`/preview/${note.id}`);
    });

    es.addEventListener('warning', (e) => {
      const w = JSON.parse(e.data);
      setPipelineWarnings(prev => [...prev, w]);
    });

    es.addEventListener('error', (e) => {
      es.close();
      setProcessing(false);
      try {
        const { message } = JSON.parse(e.data);
        setPipelineError(message);
      } catch {
        setPipelineError('Erreur de connexion au serveur');
      }
    });
  }

  const dropdownClass = 'h-12 px-4 rounded-md text-[15px] bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.06] text-text-primary';

  return (
    <div className="flex justify-center px-4 py-6 md:py-8">
      <div className="w-full max-w-xl">
        <CameraInputs />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Capturer un cours</h1>
          <p className="text-sm text-text-secondary mt-1">
            {processing
              ? 'Analyse en cours…'
              : pages.length > 0
                ? `${pages.length} page${pages.length > 1 ? 's' : ''} sélectionnée${pages.length > 1 ? 's' : ''}`
                : 'Photographie tes notes manuscrites'}
          </p>
        </div>

        <div className="space-y-4">
          {/* Panel de progression (remplace la zone photo pendant le traitement) */}
          {processing ? (
            <ProgressPanel steps={pipelineSteps} warnings={pipelineWarnings} error={pipelineError} />
          ) : (
            /* Zone pages */
            <GlassCard className="p-4">
              {pages.length === 0 ? (
                <button
                  onClick={triggerGallery}
                  className="w-full py-14 flex flex-col items-center gap-3
                    text-text-tertiary hover:text-text-secondary
                    hover:bg-black/[0.02] dark:hover:bg-white/[0.02]
                    transition-colors rounded-md"
                >
                  <Images size={36} strokeWidth={1.5} />
                  <span className="text-sm font-medium">Sélectionner des photos</span>
                  <span className="text-xs">Plusieurs pages supportées</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {pages.map(({ url }, idx) => (
                      <div key={url}
                        className="relative group rounded-md overflow-hidden aspect-[3/4]
                          animate-scale-in ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                        <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-1.5 left-1.5
                          bg-black/60 text-white text-[10px] font-semibold
                          px-1.5 py-0.5 rounded-sm leading-none">
                          p.{idx + 1}
                        </div>
                        <button onClick={() => removePage(idx)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white
                            flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Supprimer la page ${idx + 1}`}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button onClick={triggerGallery}
                      className="aspect-[3/4] rounded-md flex flex-col items-center justify-center gap-1.5
                        border-2 border-dashed border-black/[0.12] dark:border-white/[0.12]
                        text-text-tertiary hover:text-accent hover:border-accent/40 transition-colors">
                      <Plus size={20} strokeWidth={1.5} />
                      <span className="text-[10px] font-medium">Ajouter</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                      <FileImage size={13} />
                      {pages.length} page{pages.length > 1 ? 's' : ''}
                    </span>
                    <button onClick={clearAll}
                      className="text-xs text-text-tertiary hover:text-status-danger transition-colors">
                      Tout effacer
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          )}

          {/* Sélecteur matière — masqué pendant le traitement */}
          {!processing && (
            <GlassCard className="p-4 space-y-2">
              <label className="text-sm font-medium text-text-secondary">Matière</label>
              <Dropdown
                value={subjectId}
                onChange={setSubjectId}
                options={subjects.map(s => ({ value: s.id, label: s.name }))}
                placeholder="Choisir une matière…"
                fullWidth
                className={dropdownClass}
              />
              {subjects.length === 0 && settings?.currentLevelId && (
                <p className="text-xs text-text-tertiary">
                  Aucune matière —{' '}
                  <button className="text-accent underline" onClick={() => navigate('/settings/subjects')}>
                    en ajouter
                  </button>
                </p>
              )}
            </GlassCard>
          )}

          {!processing && (
            <Button
              className="w-full"
              onClick={startIngest}
              disabled={pages.length === 0 || !subjectId}
            >
              {pages.length > 1 ? `Ingérer ${pages.length} pages` : 'Ingérer le cours'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
