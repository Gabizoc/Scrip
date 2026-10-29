import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, CloudOff } from 'lucide-react';
import { api } from '../lib/api.js';
import { subjectIcon } from '../lib/noteUtils.js';
import { enqueueCapture, isNetworkError } from '../lib/offlineQueue.js';
import { useCamera } from '../hooks/useCamera.jsx';
import { useIngestJob } from '../hooks/useIngestJob.js';
import Button from '../components/Button.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Dropdown from '../components/Dropdown.jsx';
import ProgressPanel from '../components/capture/ProgressPanel.jsx';
import PageGrid from '../components/capture/PageGrid.jsx';
import SubfolderPicker from '../components/capture/SubfolderPicker.jsx';
import QueueStatus from '../components/capture/QueueStatus.jsx';

export default function Capture() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pages, setPages] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [userNote, setUserNote] = useState('');

  const [jobId, setJobId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [savedOffline, setSavedOffline] = useState(false);

  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', settings?.currentLevelId ?? null],
    queryFn: () => api.getSubjects(settings?.currentLevelId ?? null),
    enabled: !!settings,
  });

  const { data: existingFolders = [] } = useQuery({
    queryKey: ['subject-folders', subjectId],
    queryFn: () => api.getSubjectFolders(subjectId),
    enabled: !!subjectId,
    staleTime: 10_000,
  });

  const clearPages = useCallback(() => {
    setPages(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return []; });
  }, []);

  const job = useIngestJob(jobId, {
    onDone: ({ note }) => {
      clearPages();
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['ingest-jobs'] });
      navigate(`/preview/${note.id}`);
    },
  });

  useEffect(() => () => pagesRef.current.forEach(p => URL.revokeObjectURL(p.url)), []);

  const addPages = useCallback((files) => {
    setSavedOffline(false);
    setPages(prev => [...prev, ...files.map(file => ({ file, url: URL.createObjectURL(file) }))]);
  }, []);

  const removePage = useCallback((idx) => {
    setPages(prev => { URL.revokeObjectURL(prev[idx].url); return prev.filter((_, i) => i !== idx); });
  }, []);

  const reorderPages = useCallback((from, to) => {
    setPages(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const { triggerGallery, CameraInputs } = useCamera({ onCapture: addPages, multiple: true });

  async function saveOffline(files) {
    await enqueueCapture({ files, subjectId, levelId: settings?.currentLevelId, userNote: userNote.trim(), subfolder: subfolder.trim() });
    clearPages();
    setSavedOffline(true);
  }

  async function startIngest() {
    if (!pages.length || !subjectId) return;
    const files = pages.map(p => p.file);
    setSubmitError(null);
    setSavedOffline(false);
    setSubmitting(true);

    try {
      if (!navigator.onLine) {
        await saveOffline(files);
        return;
      }
      const res = await api.ingest(files, subjectId, settings?.currentLevelId, userNote, subfolder);
      setJobId(res.jobId);
      qc.invalidateQueries({ queryKey: ['ingest-jobs'] });
    } catch (err) {
      if (isNetworkError(err)) {
        try { await saveOffline(files); } catch { setSubmitError('Serveur injoignable et enregistrement hors ligne impossible.'); }
      } else {
        setSubmitError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function backToForm() {
    setJobId(null);
  }

  const processing = !!jobId;
  const dropdownClass = 'h-12 px-4 rounded-md text-[15px] bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.06] text-text-primary';

  return (
    <div className="flex justify-center px-4 py-6 md:py-8">
      <div className="w-full max-w-xl">
        <CameraInputs />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Capturer un cours</h1>
          <p className="text-sm text-text-secondary mt-1">
            {processing
              ? (job.error ? 'Analyse interrompue' : 'Analyse en cours…')
              : pages.length > 0
                ? `${pages.length} page${pages.length > 1 ? 's' : ''} sélectionnée${pages.length > 1 ? 's' : ''}`
                : 'Photographie tes notes manuscrites'}
          </p>
        </div>

        <div className="space-y-4">
          {processing ? (
            <>
              <ProgressPanel key={jobId} steps={job.steps} warnings={job.warnings} error={job.error} />
              {job.error && (
                <Button className="w-full" onClick={backToForm}>
                  {pages.length > 0 ? 'Modifier et réessayer' : 'Retour'}
                </Button>
              )}
            </>
          ) : (
            <>
              <QueueStatus currentJobId={jobId} onFollow={setJobId} />

              {savedOffline && (
                <p className="text-sm text-text-secondary bg-accent/10 rounded-md px-3 py-2 flex items-start gap-2">
                  <CloudOff size={16} className="shrink-0 mt-0.5 text-accent" />
                  Pas de connexion : la capture est enregistrée sur cet appareil et sera envoyée automatiquement au retour du réseau.
                </p>
              )}

              <PageGrid pages={pages} onAdd={triggerGallery} onRemove={removePage} onClear={clearPages} onReorder={reorderPages} />

              <GlassCard className="p-4 space-y-2">
                <label className="text-sm font-medium text-text-secondary">Matière</label>
                <Dropdown
                  value={subjectId}
                  onChange={setSubjectId}
                  options={subjects.map(s => ({ value: s.id, label: s.name, icon: subjectIcon(s.name, s.emoji ?? null) }))}
                  placeholder="Choisir une matière…"
                  fullWidth
                  className={dropdownClass}
                />
                {subjects.length === 0 && settings?.currentLevelId && (
                  <p className="text-xs text-text-tertiary">
                    Aucune matière ·{' '}
                    <button className="text-accent underline" onClick={() => navigate('/settings/subjects')}>
                      en ajouter
                    </button>
                  </p>
                )}
              </GlassCard>

              {subjectId && (
                <SubfolderPicker value={subfolder} onChange={setSubfolder} existingFolders={existingFolders} />
              )}

              <GlassCard className="p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
                  <MessageSquarePlus size={14} className="text-text-tertiary" />
                  Note pour l'IA
                  <span className="text-[11px] font-normal text-text-tertiary ml-auto">facultatif</span>
                </label>
                <textarea
                  value={userNote}
                  onChange={e => setUserNote(e.target.value)}
                  placeholder={'Ex : "ne traite pas ce qui est écrit en noir" ou "ignorer la partie III"'}
                  rows={2}
                  maxLength={2000}
                  className="w-full px-3 py-2 rounded-lg text-sm text-text-primary
                    bg-black/[0.03] dark:bg-white/[0.04]
                    border border-black/[0.08] dark:border-white/[0.06]
                    placeholder:text-text-tertiary
                    resize-none focus:outline-none focus:border-accent/40 transition-colors"
                />
              </GlassCard>

              {submitError && (
                <p className="text-sm text-status-danger bg-status-danger/10 rounded-md px-3 py-2">
                  {submitError}
                </p>
              )}

              <Button
                className="w-full"
                onClick={startIngest}
                disabled={pages.length === 0 || !subjectId || submitting}
              >
                {submitting
                  ? 'Envoi…'
                  : pages.length > 1 ? `Ingérer ${pages.length} pages` : 'Ingérer le cours'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
