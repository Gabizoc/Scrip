import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { parseScore, scoreColor, subjectColor, relativeDate } from '../lib/noteUtils.js';

export default function NoteListRow({ note }) {
  const navigate = useNavigate();
  const score    = parseScore(note.metadata?.qualite_francais);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/preview/${note.id}`)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/preview/${note.id}`); }}
      aria-label={`Ouvrir le cours : ${note.title}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 hover:bg-white/[0.04] active:bg-white/[0.07] group"
    >
      {/* Icône */}
      <FileText
        size={14}
        className="flex-shrink-0 text-text-tertiary group-hover:text-text-secondary transition-colors"
      />

      {/* Titre */}
      <span className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">
        {note.title}
      </span>

      {/* Matière (masquée sur mobile) */}
      <span className="hidden md:inline-flex shrink-0 w-[88px] justify-center">
        {note.subject && (
          <span
            className={[
              'items-center text-[10px] font-semibold px-2 py-0.5 rounded-full truncate',
              subjectColor(note.subject),
            ].join(' ')}
          >
            {note.subject}
          </span>
        )}
      </span>

      {/* Date (masquée sur mobile) */}
      <span className="hidden md:block shrink-0 w-[64px] text-right text-xs text-text-tertiary">
        {relativeDate(note.createdAt)}
      </span>

      {/* Score */}
      <span className="shrink-0 w-[52px] text-right">
        {score != null ? (
          <span className={`text-xs font-semibold font-mono ${scoreColor(score)}`}>
            {score}/100
          </span>
        ) : null}
      </span>
    </div>
  );
}
