// frontend/src/components/NoteCard.jsx
import { useNavigate } from 'react-router-dom';
import GlassCard from './GlassCard.jsx';

export default function NoteCard({ note }) {
  const navigate = useNavigate();
  const date = new Date(note.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  const score = note.metadata?.qualite_francais;

  return (
    <GlassCard
      className="p-4 cursor-pointer active:scale-[0.98] transition-transform duration-100"
      onClick={() => navigate(`/preview/${note.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-text-primary truncate">
            {note.title}
          </h3>
          <p className="text-sm text-text-secondary mt-0.5">{date}</p>
        </div>
        {score != null && (
          <span className="text-xs font-mono text-text-tertiary shrink-0 mt-0.5">
            {score}/100
          </span>
        )}
      </div>
    </GlassCard>
  );
}
