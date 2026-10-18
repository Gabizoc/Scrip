import { FolderOpen } from 'lucide-react';
import GlassCard from '../GlassCard.jsx';

// Saisie du sous-dossier, avec suggestions tirées des dossiers existants de la matière.
export default function SubfolderPicker({ value, onChange, existingFolders }) {
  return (
    <GlassCard className="p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-text-secondary mb-2">
        <FolderOpen size={14} className="text-text-tertiary" />
        Sous-dossier
        <span className="text-[11px] font-normal text-text-tertiary ml-auto">facultatif</span>
      </label>
      <input
        list="folder-suggestions"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="ex : Chapitre 1 ou Chapitre 1/Thème A"
        className="w-full px-3 py-2 rounded-lg text-sm text-text-primary
          bg-black/[0.03] dark:bg-white/[0.04]
          border border-black/[0.08] dark:border-white/[0.06]
          placeholder:text-text-tertiary
          focus:outline-none focus:border-accent/40 transition-colors"
      />
      {existingFolders.length > 0 && (
        <>
          <datalist id="folder-suggestions">
            {existingFolders.map(f => <option key={f} value={f} />)}
          </datalist>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {existingFolders.slice(0, 6).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => onChange(f)}
                className={[
                  'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                  value === f
                    ? 'border-accent/60 text-accent bg-accent/10'
                    : 'border-black/[0.1] dark:border-white/[0.1] text-text-tertiary hover:text-text-secondary hover:border-accent/30',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}
