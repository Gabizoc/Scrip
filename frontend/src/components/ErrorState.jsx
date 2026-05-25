// frontend/src/components/ErrorState.jsx
// Illustration d'erreur générique — utilisée partout où une requête échoue.

export default function ErrorState({
  message = 'Une erreur est survenue.',
  onRetry,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 select-none">
      <img
        src="/error-500.png"
        alt="Erreur"
        className="w-56 sm:w-72 pointer-events-none"
        draggable={false}
        style={{
          maskImage: 'radial-gradient(ellipse 80% 75% at 50% 45%, black 45%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 75% at 50% 45%, black 45%, transparent 80%)',
        }}
      />
      <div className="flex flex-col items-center gap-2 text-center">
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
