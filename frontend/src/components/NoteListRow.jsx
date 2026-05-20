import { useNavigate } from 'react-router-dom';
import { parseScore, scoreColor, subjectColor, subjectDotColor, relativeDate } from '../lib/noteUtils.js';

// Mini score ring (arc SVG)
function ScoreRing({ score }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color =
    score >= 90 ? '#22c55e' :
    score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <span className="relative inline-flex items-center justify-center w-[26px] h-[26px] flex-shrink-0">
      <svg width="26" height="26" className="-rotate-90" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r={r} fill="none" stroke="currentColor"
          className="text-black/[0.06] dark:text-white/[0.08]" strokeWidth="2.5" />
        <circle cx="13" cy="13" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className={`absolute text-[8px] font-bold font-mono ${scoreColor(score)}`} style={{ letterSpacing: '-0.04em' }}>
        {score}
      </span>
    </span>
  );
}

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
      className="group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
        transition-all duration-100
        hover:bg-black/[0.03] dark:hover:bg-white/[0.04]
        border border-transparent hover:border-black/[0.04] dark:hover:border-white/[0.06]"
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
      <span className="shrink-0 w-[32px] flex justify-end">
        {score != null ? <ScoreRing score={score} /> : (
          <span className="w-[26px] h-[26px] rounded-full border border-dashed border-black/[0.08] dark:border-white/[0.10]" />
        )}
      </span>
    </div>
  );
}
