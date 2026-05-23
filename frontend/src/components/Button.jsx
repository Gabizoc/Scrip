// frontend/src/components/Button.jsx

const VARIANTS = {
  primary:   'bg-accent text-white font-semibold shadow-[0_4px_16px_rgba(110,108,232,0.35)] hover:shadow-[0_6px_24px_rgba(110,108,232,0.5)] hover:bg-accent/90',
  secondary: 'glass-card text-text-primary hover:bg-white/60 dark:hover:bg-white/[0.08]',
  danger:    'bg-status-danger/10 text-status-danger border border-status-danger/20 hover:bg-status-danger/20',
};

export default function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'h-14 px-6 rounded-md',
        'text-[15px] font-semibold',
        'transition-all duration-100',
        'active:scale-[0.96]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
