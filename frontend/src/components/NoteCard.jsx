// frontend/src/components/NoteCard.jsx
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard.jsx';

const SCORE_COLOR = (s) => {
  if (s >= 80) return 'text-status-success';
  if (s >= 60) return 'text-status-warning';
  return 'text-status-danger';
};

export default function NoteCard({ note }) {
  const navigate = useNavigate();
  const date = new Date(note.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const score = note.metadata?.qualite_francais;

  return (
    <GlassCard
      className="p-5 cursor-pointer hover:shadow-lg transition-all duration-150 active:scale-[0.98]"
      onClick={() => navigate(`/preview/${note.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/preview/${note.id}`);
      }}
      aria-label={`Ouvrir le cours : ${note.title}`}
    >
      <h3 className="text-[15px] font-semibold text-text-primary line-clamp-2 mb-3 leading-snug">
        {note.title}
      </h3>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">{date}</span>
        {score != null && (
          <span className={`text-xs font-semibold font-mono ${SCORE_COLOR(score)}`}>
            {score}/100
          </span>
        )}
      </div>
    </GlassCard>
  );
}
