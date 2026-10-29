import { useRef } from 'react';
import { X } from 'lucide-react';

export const COLOR_PALETTE = [
  '#6e6ce8', '#60a5fa', '#34d399', '#f59e0b',
  '#f472b6', '#22d3ee', '#f87171', '#a78bfa',
  '#4ade80', '#fb923c', '#e879f9', '#94a3b8',
];


export default function ColorPickerField({ value, onChange }) {
  const colorInputRef = useRef(null);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">Couleur</label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLOR_PALETTE.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(value === c ? '' : c)}
            title={c}
            className={[
              'w-5 h-5 rounded-full transition-transform shrink-0',
              'hover:scale-110 focus:outline-none',
              value === c ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900 scale-110' : '',
            ].join(' ')}
            style={{ background: c, '--tw-ring-color': c }}
          />
        ))}
        <button
          type="button"
          title="Couleur personnalisée"
          onClick={() => colorInputRef.current?.click()}
          className={[
            'w-5 h-5 rounded-full border-2 border-dashed border-black/20 dark:border-white/20',
            'flex items-center justify-center text-[9px] text-text-tertiary hover:border-accent/60 transition-colors shrink-0',
            value && !COLOR_PALETTE.includes(value) ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900' : '',
          ].join(' ')}
          style={value && !COLOR_PALETTE.includes(value) ? { background: value + '44', ringColor: value } : {}}
        >
          +
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={value || '#6e6ce8'}
          onChange={e => onChange(e.target.value)}
          className="sr-only"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            title="Retirer la couleur"
            className="text-[10px] text-text-tertiary hover:text-status-danger transition-colors ml-1"
          >
            <X size={11} />
          </button>
        )}
        {value && (
          <span className="text-[10px] text-text-tertiary font-mono">{value}</span>
        )}
      </div>
    </div>
  );
}
