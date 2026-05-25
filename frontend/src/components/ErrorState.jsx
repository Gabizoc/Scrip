// frontend/src/components/ErrorState.jsx
export default function ErrorState({ message = 'Une erreur est survenue.', onRetry }) {
  const imgStyle = {
    maskImage: 'radial-gradient(ellipse 82% 78% at 50% 48%, black 42%, transparent 78%)',
    WebkitMaskImage: 'radial-gradient(ellipse 82% 78% at 50% 48%, black 42%, transparent 78%)',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 select-none">
      {/* Image light */}
      <img
        src="/error-light.png"
        alt="Erreur"
        draggable={false}
        className="w-56 sm:w-72 pointer-events-none dark:hidden"
        style={imgStyle}
      />
      {/* Image dark */}
      <img
        src="/error-dark.png"
        alt="Erreur"
        draggable={false}
        className="w-56 sm:w-72 pointer-events-none hidden dark:block"
        style={imgStyle}
      />

      <div className="flex flex-col items-center gap-2 text-center -mt-2">
        <p className="text-sm font-medium text-text-secondary">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-accent hover:text-accent/70 underline underline-offset-2 transition-colors"
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
