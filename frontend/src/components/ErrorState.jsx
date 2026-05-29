import { WifiOff } from 'lucide-react';

export default function ErrorState({ message = 'Une erreur est survenue.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-status-danger/10 flex items-center justify-center">
        <WifiOff size={24} className="text-status-danger" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-text-primary">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-accent hover:text-accent/70 underline underline-offset-2 transition-colors"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
