// frontend/src/pages/Capture.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, UploadCloud } from 'lucide-react';
import { api } from '../lib/api.js';
import { useCamera } from '../hooks/useCamera.jsx';
import Button from '../components/Button.jsx';
import GlassCard from '../components/GlassCard.jsx';

export default function Capture() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState(null);
  const [subjectId, setSubjectId] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', settings?.currentLevelId],
    queryFn: () => api.getSubjects(settings?.currentLevelId),
    enabled: !!settings?.currentLevelId,
  });

  const { trigger, CameraInput } = useCamera({ onCapture: setPhoto });

  const photoUrl = photo ? URL.createObjectURL(photo) : null;

  const ingest = useMutation({
    mutationFn: () => api.ingest(photo, subjectId, settings?.currentLevelId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      navigate(`/preview/${data.note.id}`);
    },
  });

  const selectClass = [
    'w-full h-12 px-4 rounded-md text-[15px]',
    'bg-black/[0.03] dark:bg-white/[0.04]',
    'border border-black/[0.08] dark:border-white/[0.06]',
    'text-text-primary focus:outline-none focus:border-accent/50',
    'transition-colors',
  ].join(' ');

  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto">
      <CameraInput />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Capturer un cours</h1>
        <p className="text-sm text-text-secondary mt-1">Photographie tes notes manuscrites</p>
      </div>

      <div className="space-y-4">
        {/* Zone photo */}
        <GlassCard className="overflow-hidden">
          {photo ? (
            <div>
              <img
                src={photoUrl}
                alt="aperçu du cours"
                className="w-full object-cover max-h-80"
              />
              <div className="p-3 flex justify-end">
                <button onClick={trigger} className="text-sm text-accent font-medium">
                  Changer la photo
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={trigger}
              className="w-full py-14 flex flex-col items-center gap-3 text-text-tertiary hover:text-text-secondary hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
            >
              <UploadCloud size={36} strokeWidth={1.5} />
              <span className="text-sm font-medium">Cliquer pour sélectionner une photo</span>
              <span className="text-xs">ou utiliser la caméra sur mobile</span>
            </button>
          )}
        </GlassCard>

        {/* Sélecteur matière */}
        <GlassCard className="p-4 space-y-2">
          <label className="text-sm font-medium text-text-secondary">Matière</label>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className={selectClass}>
            <option value="">Choisir une matière...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {subjects.length === 0 && settings?.currentLevelId && (
            <p className="text-xs text-text-tertiary">
              Aucune matière —{' '}
              <button className="text-accent underline" onClick={() => navigate('/settings/subjects')}>
                en ajouter
              </button>
            </p>
          )}
        </GlassCard>

        {ingest.error && (
          <p className="text-status-danger text-sm">{ingest.error.message}</p>
        )}

        <Button
          className="w-full"
          onClick={() => ingest.mutate()}
          disabled={!photo || !subjectId || ingest.isPending}
        >
          {ingest.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Traitement en cours... (~30s)
            </span>
          ) : 'Ingérer le cours'}
        </Button>
      </div>
    </div>
  );
}
