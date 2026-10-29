import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ImageIcon } from 'lucide-react';
import { api } from '../../lib/api.js';
import Lightbox from './Lightbox.jsx';

export default function SourcePhotos({ noteId }) {
  const [open, setOpen]       = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['note-sources', noteId], queryFn:  () => api.getNoteSources(noteId), enabled:  !!noteId, });

  if (!isLoading && sources.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors w-full"
      >
        <ImageIcon size={13} />
        <span className="font-medium">
          {isLoading ? 'Photos originales…' : `${sources.length} photo${sources.length > 1 ? 's' : ''} originale${sources.length > 1 ? 's' : ''}`}
        </span>
        <ChevronDown size={13} className={`ml-auto transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sources.map((src, i) => (
            <button
              key={src.filename}
              onClick={() => setLightbox(i)}
              className="relative group aspect-[3/4] rounded-lg overflow-hidden
                ring-1 ring-black/[0.08] dark:ring-white/[0.08]
                hover:ring-accent/50 transition-all duration-150"
            >
              <img
                src={src.url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div className="absolute bottom-1.5 left-1.5
                bg-black/60 text-white text-[10px] font-semibold
                px-1.5 py-0.5 rounded leading-none">
                {i + 1}
              </div>
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          sources={sources}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox(i => (i - 1 + sources.length) % sources.length)}
          onNext={() => setLightbox(i => (i + 1) % sources.length)}
        />
      )}
    </div>
  );
}
