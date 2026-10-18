import { useState, useEffect } from 'react';

export function useActiveHeading(ids) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!ids.length) return;
    const obs = new IntersectionObserver(
      entries => {
        const hit = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveId(hit.target.id);
      }, { rootMargin: '-5% 0px -75% 0px', threshold: 0 }, );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);

  return activeId;
}

const TOC_INDENT = [0, 0, 12, 24, 36, 48, 60];

export default function TableOfContents({ headings, activeId, onHeadingClick }) {
  if (!headings.length) return null;
  return (
    <nav aria-label="Table des matières">
      <p className="text-[9px] uppercase tracking-widest font-semibold text-text-tertiary mb-3">
        Chapitres
      </p>
      <ul className="space-y-px">
        {headings.map(({ level, text, id }) => {
          const indent = TOC_INDENT[Math.min(level, 6)] ?? 60;
          return (
            <li key={id}>
              <button
                onClick={() => onHeadingClick(id)}
                title={text}
                style={{ paddingLeft: `${indent + 8}px` }}
                className={[
                  'w-full text-left leading-snug py-1.5 pr-2 rounded-md',  'transition-all duration-150 truncate block', level === 1 ? 'text-[11px]' : level === 2 ? 'text-[10.5px]' : 'text-[10px]', activeId === id
                    ? 'text-accent font-semibold bg-accent/[0.08]'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]', ].join(' ')}
              >
                {level >= 3 && (
                  <span className="mr-1 opacity-30">{'·'.repeat(level - 2)}</span>
                )}
                {text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
