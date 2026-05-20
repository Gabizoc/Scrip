import { Folder } from 'lucide-react';
import { subjectIcon } from '../lib/noteUtils.js';

// ── Item sidebar desktop ──────────────────────────────────────────────────────
function SidebarItem({ icon, name, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150',
        active
          ? 'bg-accent/[0.18] text-accent'
          : 'text-text-secondary hover:bg-white/[0.05] hover:text-text-primary',
      ].join(' ')}
    >
      <span className="w-[16px] flex-shrink-0 flex items-center justify-center leading-none">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-semibold truncate">{name}</span>
        <span className={['block text-[9px] font-normal', active ? 'opacity-70' : 'opacity-50'].join(' ')}>
          {count} cours
        </span>
      </span>
    </button>
  );
}

// ── Chip mobile ───────────────────────────────────────────────────────────────
function MobileChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150',
        active
          ? 'bg-accent text-white shadow-sm'
          : 'bg-black/[0.05] dark:bg-white/[0.07] text-text-secondary hover:bg-black/[0.09] dark:hover:bg-white/[0.12]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function SubjectSidebar({ subjects, activeSubject, onSelect, totalCount }) {
  return (
    <>
      {/* ── Desktop : colonne fixe 130px ── */}
      <aside className="hidden md:flex flex-col w-[130px] shrink-0 gap-0.5 pt-0.5 overflow-y-auto">
        <SidebarItem
          icon={<Folder size={13} />}
          name="Tous"
          count={totalCount}
          active={activeSubject === null}
          onClick={() => onSelect(null)}
        />
        <div className="h-px bg-white/[0.05] my-1.5 mx-1" />
        {subjects.map(([name, count]) => (
          <SidebarItem
            key={name}
            icon={<span className="text-sm leading-none">{subjectIcon(name)}</span>}
            name={name}
            count={count}
            active={activeSubject === name}
            onClick={() => onSelect(activeSubject === name ? null : name)}
          />
        ))}
      </aside>

      {/* ── Mobile : chips scrollables ── */}
      <div
        className="md:hidden flex gap-2 overflow-x-auto mb-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <MobileChip active={activeSubject === null} onClick={() => onSelect(null)}>
          Tous
        </MobileChip>
        {subjects.map(([name]) => (
          <MobileChip
            key={name}
            active={activeSubject === name}
            onClick={() => onSelect(activeSubject === name ? null : name)}
          >
            <span className="mr-1">{subjectIcon(name)}</span>{name}
          </MobileChip>
        ))}
      </div>
    </>
  );
}
