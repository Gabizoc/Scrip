// frontend/src/components/GlassCard.jsx

/**
 * Conteneur frosted glass.
 * Mode sombre : fond sombre semi-transparent, ombre forte.
 * Mode clair  : fond blanc semi-transparent, ombre douce.
 */
export default function GlassCard({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={[
        'rounded-lg',
        'bg-white/70',
        'border border-black/[0.08]',
        'shadow-[0_8px_32px_rgba(10,10,12,0.08)]',
        'dark:bg-bg-elevated/60',
        'dark:border-white/10',
        'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)]',
        'backdrop-blur-glass',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
