import { useState } from 'react';
import { Trash2, Pencil, Check } from 'lucide-react';
import GlassCard from '../GlassCard.jsx';
import Dropdown from '../Dropdown.jsx';
import EmojiButton from './EmojiButton.jsx';
import ColorPickerField from './ColorPickerField.jsx';

function InlineField({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 px-2.5 rounded-md text-[13px]
          bg-black/[0.04] dark:bg-white/[0.05]
          border border-black/[0.08] dark:border-white/[0.07]
          text-text-primary placeholder:text-text-tertiary
          focus:outline-none focus:border-accent/40 transition-colors"
      />
    </div>
  );
}


export default function SubjectCard({ subject, levels, prompts, onPatch, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({});

  function startEdit() {
    setDraft({ name: subject.name, outputFolder: subject.outputFolder, prompt: subject.prompt, emoji: subject.emoji ?? '', color: subject.color ?? '' });
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); }
  function save() {
    onPatch(subject.id, draft);
    setEditing(false);
  }

  const df = k => v => setDraft(d => ({ ...d, [k]: v }));
  const level = levels.find(l => l.id === subject.levelId);
  const dropdownClass = 'h-8 px-2.5 rounded-md text-[13px] bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.07] text-text-primary';

  return (
    <GlassCard className="px-4 py-3">
      <div className="flex items-center gap-3">
        <EmojiButton
          value={editing ? draft.emoji : (subject.emoji ?? '')}
          name={editing ? draft.name : subject.name}
          onChange={v => editing ? df('emoji')(v) : onPatch(subject.id, { emoji: v })}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {subject.color && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: subject.color }}
              />
            )}
            <p className="text-[15px] font-medium text-text-primary truncate">{subject.name}</p>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">
            {level?.name ?? '·'} · {subject.prompt} · {subject.outputFolder}
          </p>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
            title="Modifier"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(subject.id)}
          className="p-1.5 rounded-md text-text-tertiary hover:text-status-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
          <InlineField label="Nom" value={draft.name} onChange={df('name')} placeholder="ex : Histoire" />
          <InlineField label="Dossier de sortie" value={draft.outputFolder} onChange={df('outputFolder')} placeholder="ex : Histoire" />
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium">Prompt IA</label>
            <Dropdown
              value={draft.prompt}
              onChange={df('prompt')}
              options={prompts.map(p => ({ value: p.key, label: p.name }))}
              fullWidth
              className={dropdownClass}
            />
          </div>
          <ColorPickerField value={draft.color ?? ''} onChange={df('color')} />
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={!draft.name || !draft.outputFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium
                bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={13} /> Enregistrer
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 rounded-md text-[12px] text-text-secondary
                hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
