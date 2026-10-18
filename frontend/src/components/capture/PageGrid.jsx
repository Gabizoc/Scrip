import { useState, useCallback } from 'react';
import { Images, Plus, X, FileImage } from 'lucide-react';
import GlassCard from '../GlassCard.jsx';

// Vignettes des pages sélectionnées, réordonnables par glisser-déposer.
export default function PageGrid({ pages, onAdd, onRemove, onClear, onReorder }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const resetDrag = useCallback(() => { setDragIdx(null); setDragOverIdx(null); }, []);

  const handleDrop = useCallback((idx) => {
    if (dragIdx !== null && dragIdx !== idx) onReorder(dragIdx, idx);
    resetDrag();
  }, [dragIdx, onReorder, resetDrag]);

  if (pages.length === 0) {
    return (
      <GlassCard className="p-4">
        <button
          onClick={onAdd}
          className="w-full py-14 flex flex-col items-center gap-3
            text-text-tertiary hover:text-text-secondary
            hover:bg-black/[0.02] dark:hover:bg-white/[0.02]
            transition-colors rounded-md"
        >
          <Images size={36} strokeWidth={1.5} />
          <span className="text-sm font-medium">Sélectionner des photos</span>
          <span className="text-xs">Plusieurs pages supportées</span>
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {pages.map(({ url }, idx) => (
            <div key={url}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
              onDrop={() => handleDrop(idx)}
              onDragEnd={resetDrag}
              className={[
                'relative group rounded-md overflow-hidden aspect-[3/4]',
                'animate-scale-in ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
                'cursor-grab active:cursor-grabbing select-none transition-all duration-150',
                dragIdx === idx ? 'opacity-30 scale-95' : '',
                dragOverIdx === idx && dragIdx !== idx
                  ? 'ring-2 ring-accent/70 scale-[1.03]'
                  : '',
              ].join(' ')}>
              <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5
                bg-black/60 text-white text-[10px] font-semibold
                px-1.5 py-0.5 rounded-sm leading-none">
                p.{idx + 1}
              </div>
              <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity
                pointer-events-none text-white/80">
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                  <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
                  <circle cx="2.5" cy="7"   r="1.5"/><circle cx="7.5" cy="7"   r="1.5"/>
                  <circle cx="2.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="11.5" r="1.5"/>
                </svg>
              </div>
              <button onClick={() => onRemove(idx)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white
                  flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Supprimer la page ${idx + 1}`}>
                <X size={12} />
              </button>
            </div>
          ))}
          <button onClick={onAdd}
            className="aspect-[3/4] rounded-md flex flex-col items-center justify-center gap-1.5
              border-2 border-dashed border-black/[0.12] dark:border-white/[0.12]
              text-text-tertiary hover:text-accent hover:border-accent/40 transition-colors">
            <Plus size={20} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">Ajouter</span>
          </button>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <FileImage size={13} />
            {pages.length} page{pages.length > 1 ? 's' : ''}
          </span>
          <button onClick={onClear}
            className="text-xs text-text-tertiary hover:text-status-danger transition-colors">
            Tout effacer
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
