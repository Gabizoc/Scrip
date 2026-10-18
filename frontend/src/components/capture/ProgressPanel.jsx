import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Scan, BrainCircuit, Wand2, Sparkles, Save } from 'lucide-react';
import GlassCard from '../GlassCard.jsx';

const PIPELINE_STEPS = [
  { id: 'ocr',       label: 'Lecture des notes',      icon: Scan },
  { id: 'structure', label: 'Structuration du contenu', icon: BrainCircuit },
  { id: 'format',    label: 'Mise en forme',           icon: Wand2 },
  { id: 'summary',   label: 'Résumé automatique',      icon: Sparkles },
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

export default function ProgressPanel({ steps, warnings = [], error }) {
  const [timings, setTimings] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const tickRef = useRef(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(tickRef.current);
  }, []);

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

  const doneCount = PIPELINE_STEPS.filter(def => steps.find(s => s.id === def.id)?.status === 'done').length;
  const runningStep = PIPELINE_STEPS.find(def => steps.find(s => s.id === def.id)?.status === 'running');

  const logEntries = steps
    .filter(s => s.detail)
    .map(s => ({ id: s.id, label: s.label ?? PIPELINE_STEPS.find(d => d.id === s.id)?.label, detail: s.detail, status: s.status }));

  return (
    <GlassCard className="overflow-hidden">
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

        <div className="flex gap-1">
          {PIPELINE_STEPS.map((def) => {
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

      <div className="px-5 py-4 space-y-3">
        {PIPELINE_STEPS.map((def) => {
          const step = steps.find(s => s.id === def.id);
          const status = step?.status ?? 'pending';
          const label = step?.label ?? def.label;
          const t = timings[def.id];
          const durMs = t?.end ? t.end - t.start : null;
          const Icon = def.icon;

          return (
            <div key={def.id} className={[
              'flex items-start gap-3 transition-all duration-300',
              status === 'pending' ? 'opacity-35' : '',
            ].join(' ')}>
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
                {status === 'running' && (
                  <div className="mt-1.5 h-0.5 w-28 rounded-full bg-accent/20 overflow-hidden">
                    <div className="h-full rounded-full bg-accent
                      animate-[shimmer_1.4s_ease-in-out_infinite]
                      [background:linear-gradient(90deg,transparent,rgba(124,122,255,0.9),transparent)]
                      [background-size:200%_100%]" />
                  </div>
                )}
              </div>

              <ElapsedBadge ms={durMs} />
            </div>
          );
        })}
      </div>

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
