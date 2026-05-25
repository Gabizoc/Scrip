// frontend/src/pages/Setup.jsx
import { useState } from 'react';
import { authApi } from '../lib/auth.js';
import GlassCard from '../components/GlassCard.jsx';

export default function Setup() {
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleRequest() {
    setError('');
    setLoading(true);
    try {
      await authApi.setupRequest();
      setSent(true);
    } catch (err) {
      setError(err.message ?? 'Erreur lors de l\'envoi du lien');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text-primary">Scrip</h1>
          <p className="text-text-tertiary text-sm mt-1">Première connexion</p>
        </div>

        <GlassCard className="p-6 space-y-4">
          {sent ? (
            <div className="text-center space-y-2">
              <p className="text-[15px] text-text-primary font-medium">Lien envoyé !</p>
              <p className="text-[13px] text-text-secondary">
                Vérifie ta boîte mail et clique sur le lien pour choisir ton mot de passe.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-text-secondary">
                Aucun mot de passe n'est configuré. Clique ci-dessous pour recevoir un lien de configuration par email.
              </p>

              {error && (
                <p className="text-red-500 text-[12px]">{error}</p>
              )}

              <button
                onClick={handleRequest}
                disabled={loading}
                className="w-full h-10 rounded-lg text-[13px] font-medium
                  bg-accent text-white hover:bg-accent/90
                  disabled:opacity-40 transition-colors"
              >
                {loading ? 'Envoi…' : 'Envoyer le lien de configuration'}
              </button>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
