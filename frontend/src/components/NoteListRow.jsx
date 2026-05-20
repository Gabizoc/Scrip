import { useNavigate } from 'react-router-dom';
import { parseScore, scoreColor, subjectColor, subjectDotColor, relativeDate } from '../lib/noteUtils.js';

export default function NoteListRow({ note }) {
  const navigate = useNavigate();
  const score    = parseScore(note.metadata?.qualite_francais);
  const dot      = subjectDotColor(note.subject ?? '');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/preview/${note.id}`)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/preview/${note.id}`); }}
      aria-label={`Ouvrir le cours : ${note.title}`}
      className="group relative flex items-center gap-3 px-4 py-2.5 cursor-pointer
        transition-colors duration-100
        hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
    >
      {/* Accent left bar on hover */}
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full
        opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ background: dot }}
      />

      {/* Dot matière */}
      <span
        className="flex-shrink-0 w-[7px] h-[7px] rounded-full ml-1"
        style={{ background: dot }}
      />

      {/* Titre */}
      <span className="flex-1 min-w-0 text-[13px] font-medium text-text-primary truncate group-hover:text-text-primary">
        {note.title}
      </span>

      {/* Matière (masquée sur mobile) */}
      <span className="hidden md:inline-flex shrink-0 w-[90px] justify-center">
        {note.subject && (
          <span className={[
            'text-[10px] font-semibold px-2 py-0.5 rounded-md truncate',
            subjectColor(note.subject),
          ].join(' ')}>
            {note.subject}
          </span>
        )}
      </span>

      {/* Date */}
      <span className="hidden md:block shrink-0 w-[80px] text-right text-[11px] text-text-tertiary tabular-nums">
        {relativeDate(note.createdAt)}
      </span>

      {/* Score */}
      <span className="shrink-0 w-[44px] text-right">
        {score != null && (
          <span className={`text-xs font-semibold font-mono ${scoreColor(score)}`}>
            {score}
          </span>
        )}
      </span>
    </div>
  );
}
