
import { subjectIcon } from '../lib/noteUtils.js';
import SubjectIcon from './SubjectIcon.jsx';

// ── Item sidebar desktop ──────────────────────────────────────────────────────
function SidebarItem({ icon, name, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-300 ease-out',
        active
          ? 'bg-accent/[0.18] text-accent'
          : 'text-text-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:text-text-primary',
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
        'flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-300 ease-out',
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
export default function SubjectSidebar({ subjects, activeSubject, onSelect, totalCount, desktopOnly, mobileOnly }) {
  return (
    <>
      {/* ── Desktop : colonne fixe 130px ── */}
      {!mobileOnly && (
        <aside className="flex flex-col w-[130px] shrink-0 gap-0.5 pt-0.5 overflow-y-auto">
          <SidebarItem
            icon={<span className="text-sm leading-none">📁</span>}
            name="Tous"
            count={totalCount}
            active={activeSubject === null}
            onClick={() => onSelect(null)}
          />
          <div className="h-px bg-white/[0.05] my-1.5 mx-1" />
          {subjects.map(([name, count, emoji]) => (
            <SidebarItem
              key={name}
              icon={
                <SubjectIcon
                  value={emoji || null}
                  fallback={subjectIcon(name, null)}
                  size={15}
                />
              }
              name={name}
              count={count}
              active={activeSubject === name}
              onClick={() => onSelect(activeSubject === name ? null : name)}
            />
          ))}
        </aside>
      )}

      {/* ── Mobile : chips scrollables ── */}
      {!desktopOnly && (
        <div
          className="flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <MobileChip active={activeSubject === null} onClick={() => onSelect(null)}>
            Tous
          </MobileChip>
          {subjects.map(([name, , emoji]) => (
            <MobileChip
              key={name}
              active={activeSubject === name}
              onClick={() => onSelect(activeSubject === name ? null : name)}
            >
              <span className="mr-1 inline-flex items-center">
                <SubjectIcon value={emoji || null} fallback={subjectIcon(name, null)} size={13} />
              </span>
              {name}
            </MobileChip>
          ))}
        </div>
      )}
    </>
  );
}
