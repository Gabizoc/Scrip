import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseScore, scoreColor, subjectDotColor } from '../lib/noteUtils.js';

const CHUNK = 8;

function RecentPill({ note }) {
  const navigate = useNavigate();
  const score = parseScore(note.metadata?.qualite_francais);
  const dot = subjectDotColor(note.subject ?? '');

  const startX = useRef(0);

  return (
    <button
      onMouseDown={e => { startX.current = e.pageX; }}
      onClick={e => { if (Math.abs(e.pageX - startX.current) > 5) { e.preventDefault(); return; } navigate(`/preview/${note.id}`); }}
      className={[
        'flex-shrink-0 w-[130px] text-left',
        'bg-white/80 dark:bg-white/[0.07]',
        'backdrop-blur-sm',
        'border border-black/[0.06] dark:border-white/[0.10]',
        'shadow-sm',
        'rounded-md px-3 py-2.5 transition-all duration-300 ease-out',
        'hover:shadow-md hover:-translate-y-0.5',
        'active:scale-95',
      ].join(' ')}
    >
      <p className="text-[11px] font-semibold text-text-primary truncate mb-1.5 leading-tight">
        {note.title}
      </p>
      <div className="flex items-center gap-1.5">
        <span
          className="w-[6px] h-[6px] rounded-full flex-shrink-0"
          style={{ background: dot }}
        />
        <span className="text-[9px] text-text-tertiary truncate flex-1">
          {note.subject ?? '·'}
        </span>
        {score != null && (
          <span className={`text-[9px] font-bold font-mono flex-shrink-0 ${scoreColor(score)}`}>
            {score}
          </span>
        )}
      </div>
    </button>
  );
}

export default function RecentStrip({ notes }) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const [visible, setVisible] = useState(CHUNK);

  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  function onMouseDown(e) {
    drag.current = { active: true, startX: e.pageX, scrollLeft: scrollRef.current.scrollLeft };
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.userSelect = 'none';
  }

  function onMouseMove(e) {
    if (!drag.current.active) return;
    const dx = e.pageX - drag.current.startX;
    scrollRef.current.scrollLeft = drag.current.scrollLeft - dx;
  }

  function onMouseUp() {
    drag.current.active = false;
    scrollRef.current.style.cursor = 'grab';
    scrollRef.current.style.userSelect = '';
  }

  const sorted = useMemo(
    () => [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [notes],
  );

  const displayed = sorted.slice(0, visible);
  const hasMore = visible < sorted.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasMore) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(v => Math.min(v + CHUNK, sorted.length));
        }
      },
      { root, threshold: 0.1 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [hasMore, sorted.length]);

  if (!notes.length) return null;

  return (
    <div className="mb-6">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-text-tertiary mb-2.5">
        Récemment ajoutés
      </p>
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {displayed.map(note => <RecentPill key={note.id} note={note} />)}
        {hasMore && (
          <div ref={sentinelRef} className="w-1 flex-shrink-0 self-stretch" />
        )}
      </div>
    </div>
  );
}
