// frontend/src/components/Button.jsx

const VARIANTS = {
  primary:   'bg-accent text-white font-semibold dark:text-bg-base',
  secondary: 'border border-black/[0.08] dark:border-white/10 text-text-primary',
  danger:    'bg-status-danger/10 text-status-danger border border-status-danger/20',
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
