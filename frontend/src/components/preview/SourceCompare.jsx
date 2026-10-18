import { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import Lightbox from './Lightbox.jsx';

// Photo originale affichée à côté de la note (mode « comparer »), pour corriger la
// transcription en ayant la page manuscrite sous les yeux.
export default function SourceCompare({ sources }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (!sources.length) return null;
  const current = sources[Math.min(index, sources.length - 1)];
  const prev = () => setIndex(i => (i - 1 + sources.length) % sources.length);
  const next = () => setIndex(i => (i + 1) % sources.length);

  return (
    <div className="sticky top-6 flex flex-col gap-2 h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span className="font-medium">Photo originale {sources.length > 1 ? `${index + 1} / ${sources.length}` : ''}</span>
        <div className="flex items-center gap-1">
          {sources.length > 1 && (
            <>
              <button onClick={prev} className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-text-primary" aria-label="Photo précédente">
                <ChevronLeft size={16} />
              </button>
              <button onClick={next} className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-text-primary" aria-label="Photo suivante">
                <ChevronRight size={16} />
              </button>
            </>
          )}
          <button onClick={() => setZoomed(true)} className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.07] hover:text-text-primary" aria-label="Agrandir">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <button
        onClick={() => setZoomed(true)}
        className="flex-1 min-h-0 rounded-xl overflow-hidden bg-black/[0.03] dark:bg-white/[0.03]
          ring-1 ring-black/[0.08] dark:ring-white/[0.08] cursor-zoom-in"
      >
        <img src={current.url} alt={`Photo ${index + 1}`} className="w-full h-full object-contain" />
      </button>

      {zoomed && (
        <Lightbox sources={sources} index={index} onClose={() => setZoomed(false)} onPrev={prev} onNext={next} />
      )}
    </div>
  );
}
