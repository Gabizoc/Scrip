const maskStyle = {
  maskImage: 'radial-gradient(ellipse 82% 78% at 50% 48%, black 42%, transparent 78%)',
  WebkitMaskImage: 'radial-gradient(ellipse 82% 78% at 50% 48%, black 42%, transparent 78%)',
};

export default function EmptyState({ title = 'Rien ici', subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 select-none">
      <img src="/illus-empty-light.png" alt="" draggable={false}
        className="w-56 sm:w-72 pointer-events-none dark:hidden" style={maskStyle} />
      <img src="/illus-empty-dark.png"  alt="" draggable={false}
        className="w-56 sm:w-72 pointer-events-none hidden dark:block" style={maskStyle} />

      <div className="flex flex-col items-center gap-1.5 text-center -mt-2">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {subtitle && <p className="text-xs text-text-tertiary">{subtitle}</p>}
        {action}
      </div>
    </div>
  );
}
