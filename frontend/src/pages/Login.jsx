import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/auth.js';
import GlassCard from '../components/GlassCard.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagic() {
    setError('');
    setLoading(true);
    try {
      await authApi.magic();
      setMagicSent(true);
    } catch (err) {
      setError(err.message ?? 'Erreur lors de l\'envoi du lien');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setError('');
    setLoading(true);
    try {
      await authApi.forgot();
      setForgotSent(true);
    } catch (err) {
      setError(err.message ?? 'Erreur lors de l\'envoi du lien');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text-primary">Scrip</h1>
          <p className="text-text-tertiary text-sm mt-1">Connexion</p>
        </div>

        <GlassCard className="p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full h-10 px-3 rounded-lg text-[13px]
                  bg-black/[0.04] dark:bg-white/[0.05]
                  border border-black/[0.08] dark:border-white/[0.07]
                  text-text-primary placeholder:text-text-tertiary
                  focus:outline-none focus:border-accent/40 transition-colors"
                placeholder="gabi@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="border-t border-black/[0.06] dark:border-white/[0.05] pt-4 space-y-2">
            {magicSent ? (
              <p className="text-[12px] text-text-secondary text-center">✓ Lien envoyé — vérifie ta boîte mail</p>
            ) : (
              <button
                onClick={handleMagic}
                disabled={loading}
                className="w-full h-9 rounded-lg text-[12px] font-medium
                  bg-black/[0.05] dark:bg-white/[0.07]
                  text-text-secondary hover:text-text-primary
                  hover:bg-black/[0.09] dark:hover:bg-white/[0.11]
                  disabled:opacity-40 transition-colors"
              >
                Connexion par lien email
              </button>
            )}

            {forgotSent ? (
              <p className="text-[12px] text-text-secondary text-center">✓ Email de réinitialisation envoyé</p>
            ) : (
              <button
                onClick={handleForgot}
                disabled={loading}
                className="w-full text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Mot de passe oublié ?
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
