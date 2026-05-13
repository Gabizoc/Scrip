// frontend/src/pages/Capture.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const ingest = useMutation({
    mutationFn: () => api.ingest(photo, subjectId, settings?.currentLevelId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      navigate(`/preview/${data.note.id}`);
    },
  });

  return (
    <div className="min-h-screen p-4">
      <CameraInput />

      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-text-secondary mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Retour</span>
      </button>

      <h2 className="text-xl font-bold text-text-primary mb-6">
        Capturer un cours
      </h2>

      <div className="space-y-4 max-w-lg">
        {/* Zone photo */}
        <GlassCard className="p-4">
          {photo ? (
            <div className="space-y-3">
              <img
                src={photoUrl}
                alt="aperçu du cours"
                className="w-full rounded-md object-cover max-h-72"
              />
              <button
                onClick={trigger}
                className="text-sm text-accent"
              >
                Changer la photo
              </button>
            </div>
          ) : (
            <button
              onClick={trigger}
              className="w-full h-44 flex flex-col items-center justify-center gap-3 text-text-tertiary"
            >
              <span className="text-5xl">📸</span>
              <span className="text-sm">Appuyer pour capturer</span>
            </button>
          )}
        </GlassCard>

        {/* Sélecteur matière */}
        <GlassCard className="p-4 space-y-2">
          <label className="text-sm text-text-secondary">Matière</label>
          <select
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            className={[
              'w-full h-12 px-4 rounded-md',
              'bg-black/[0.03] dark:bg-white/[0.04]',
              'border border-black/[0.08] dark:border-white/[0.06]',
              'text-text-primary text-[15px]',
              'focus:outline-none',
            ].join(' ')}
          >
            <option value="">Choisir une matière...</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {subjects.length === 0 && settings?.currentLevelId && (
            <p className="text-xs text-text-tertiary">
              Aucune matière pour ce niveau —{' '}
              <button
                className="text-accent underline"
                onClick={() => navigate('/settings/subjects')}
              >
                en ajouter
              </button>
            </p>
          )}
        </GlassCard>

        {/* Erreur */}
        {ingest.error && (
          <p className="text-status-danger text-sm px-1">
            {ingest.error.message}
          </p>
        )}

        {/* CTA */}
        <Button
          className="w-full"
          onClick={() => ingest.mutate()}
          disabled={!photo || !subjectId || ingest.isPending}
        >
          {ingest.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Traitement en cours...
            </span>
          ) : (
            'Ingérer le cours'
          )}
        </Button>
      </div>
    </div>
  );
}
