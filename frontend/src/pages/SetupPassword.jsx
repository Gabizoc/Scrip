// frontend/src/pages/SetupPassword.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/auth.js';
import GlassCard from '../components/GlassCard.jsx';

export default function SetupPassword() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      setError('Mot de passe trop court (8 caractères minimum)');
      return;
    }
    if (!token) {
      setError('Token manquant — utilise le lien reçu par email');
      return;
    }
    setLoading(true);
    try {
      await authApi.setupComplete(token, password);
      await qc.invalidateQueries({ queryKey: ['auth-status'] });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Erreur lors de la configuration');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text-primary">Scrip</h1>
          <p className="text-text-tertiary text-sm mt-1">Choisir un mot de passe</p>
        </div>

        <GlassCard className="p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-lg text-[13px]
                  bg-black/[0.04] dark:bg-white/[0.05]
                  border border-black/[0.08] dark:border-white/[0.07]
                  text-text-primary placeholder:text-text-tertiary
                  focus:outline-none focus:border-accent/40 transition-colors"
                placeholder="8 caractères minimum"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-lg text-[13px]
                  bg-black/[0.04] dark:bg-white/[0.05]
                  border border-black/[0.08] dark:border-white/[0.07]
                  text-text-primary placeholder:text-text-tertiary
                  focus:outline-none focus:border-accent/40 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-500 text-[12px]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-[13px] font-medium
                bg-accent text-white hover:bg-accent/90
                disabled:opacity-40 transition-colors"
            >
              {loading ? 'Configuration…' : 'Définir le mot de passe'}
            </button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
