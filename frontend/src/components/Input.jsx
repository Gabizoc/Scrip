
export default function Input({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm text-text-secondary">{label}</label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'h-12 px-4 rounded-md',
          'bg-black/[0.03] dark:bg-white/[0.04]',
          'border border-black/[0.08] dark:border-white/[0.06]',
          'text-text-primary placeholder:text-text-tertiary',
          'text-[15px]',
          'focus:outline-none',
          'focus:border-accent/40',
          'focus:shadow-[0_0_0_4px_rgb(var(--accent)/0.15)]',
          'transition-all duration-150',
        ].join(' ')}
      />
    </div>
  );
}
