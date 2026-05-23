// frontend/src/components/GlassCard.jsx

export default function GlassCard({ children, className = '', ...props }) {
  return (
    <div
      className={['glass-card rounded-lg', className].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
