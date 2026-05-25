// frontend/src/pages/Settings/index.jsx
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Copy, Check, Eye, EyeOff, LogOut } from 'lucide-react';
import { api } from '../../lib/api.js';
import { authApi } from '../../lib/auth.js';
import GlassCard from '../../components/GlassCard.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import Dropdown from '../../components/Dropdown.jsx';

const NAV_ITEMS = [
  { label: 'Gérer les niveaux',  path: '/settings/levels' },
  { label: 'Gérer les matières', path: '/settings/subjects' },
];

/** Copie du texte dans le presse-papiers avec feedback visuel */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }
  return (
    <button
      onClick={doCopy}
      className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/70 transition-colors"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copié !' : 'Copier'}
    </button>
  );
}

/** Génère un mot de passe aléatoire de 16 caractères via crypto.getRandomValues
 *  (CSPRNG du navigateur — pas Math.random). */
function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export default function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings });
  const { data: levels = [] } = useQuery({ queryKey: ['levels'], queryFn: api.getLevels });

  const updateSettings = useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  // ── Password change local state ─────────────────────────────────────────────
  const [currentPass,  setCurrentPass]  = useState('');
  const [newPass,      setNewPass]      = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');
  const [passError,    setPassError]    = useState('');
  const [passSaved,    setPassSaved]    = useState(false);
  const [passLoading,  setPassLoading]  = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPassError('');
    if (newPass !== confirmPass) { setPassError('Les mots de passe ne correspondent pas'); return; }
    if (newPass.length < 8)      { setPassError('8 caractères minimum'); return; }
    setPassLoading(true);
    try {
      await authApi.changePassword(currentPass, newPass);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setPassSaved(true);
      setTimeout(() => setPassSaved(false), 2000);
    } catch (err) {
      setPassError(err.message ?? 'Erreur lors du changement de mot de passe');
    } finally {
      setPassLoading(false);
    }
  }

  async function handleLogout() {
    await authApi.logout();
    navigate('/login', { replace: true });
  }

  // ── WebDAV local state ──────────────────────────────────────────────────────
  const [publicUrl,    setPublicUrl]    = useState('');
  const [webdavUser,   setWebdavUser]   = useState('scrip');
  const [webdavPass,   setWebdavPass]   = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [webdavSaved,  setWebdavSaved]  = useState(false);
  // Guard : n'initialise les champs qu'une seule fois au premier chargement,
  // pour éviter d'écraser les modifications en cours lors des refetch React Query.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!settings || initializedRef.current) return;
    initializedRef.current = true;
    if (settings.publicUrl)        setPublicUrl(settings.publicUrl);
    if (settings.webdav?.username) setWebdavUser(settings.webdav.username);
  }, [settings]);

  const webdavEnabled = settings?.webdav?.enabled ?? false;
  const webdavUrl     = publicUrl ? `${publicUrl.replace(/\/$/, '')}/webdav` : null;

  const nginxSnippet = `location /webdav/ {
    proxy_pass http://localhost:5001/webdav/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 10M;
}`;

  function toggleWebdav() {
    updateSettings.mutate({ webdav: { enabled: !webdavEnabled } });
  }

  function saveWebdav() {
    updateSettings.mutate({
      publicUrl,
      webdav: {
        username: webdavUser,
        ...(webdavPass ? { password: webdavPass } : {}),
      },
    }, {
      onSuccess: () => {
        setWebdavPass('');
        setWebdavSaved(true);
        setTimeout(() => setWebdavSaved(false), 2000);
      },
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Paramètres</h1>
      </div>

      <div className="space-y-4">
        {/* Thème — mobile only */}
        <div className="md:hidden">
          <GlassCard className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Thème</h3>
            <ThemeToggle />
          </GlassCard>
        </div>

        {/* Niveau courant */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Niveau actuel</h3>
          <Dropdown
            value={settings?.currentLevelId ?? ''}
            onChange={v => updateSettings.mutate({ currentLevelId: v })}
            options={levels.map(l => ({ value: l.id, label: l.name }))}
            placeholder="Choisir un niveau…"
            fullWidth
            className="h-12 px-4 rounded-md text-[15px]
              bg-black/[0.03] dark:bg-white/[0.04]
              border border-black/[0.08] dark:border-white/[0.06]
              text-text-primary"
          />
        </GlassCard>

        {/* Navigation */}
        {NAV_ITEMS.map(({ label, path }) => (
          <GlassCard key={path} className="p-4 cursor-pointer" onClick={() => navigate(path)}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-text-primary">{label}</span>
              <ChevronRight size={18} className="text-text-tertiary" />
            </div>
          </GlassCard>
        ))}

        {/* Vault path */}
        <GlassCard className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Vault path</h3>
          <input
            key={settings?.vaultPath}
            defaultValue={settings?.vaultPath ?? ''}
            onBlur={e => updateSettings.mutate({ vaultPath: e.target.value })}
            className="w-full h-12 px-4 rounded-md text-sm font-mono
              bg-black/[0.03] dark:bg-white/[0.04]
              border border-black/[0.08] dark:border-white/[0.06]
              text-text-primary focus:outline-none focus:border-accent/50"
            placeholder="/home/scrip/vault"
          />
        </GlassCard>

        {/* ── Obsidian WebDAV ────────────────────────────────────────────────── */}
        <GlassCard className="p-4 space-y-4">
          {/* Header + toggle */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Obsidian WebDAV</h3>
            <button
              onClick={toggleWebdav}
              className={[
                'flex items-center w-10 h-5 rounded-full p-0.5 transition-colors duration-200 flex-shrink-0',
                webdavEnabled ? 'bg-accent' : 'bg-black/[0.12] dark:bg-white/[0.15]',
              ].join(' ')}
              aria-label={webdavEnabled ? 'Désactiver WebDAV' : 'Activer WebDAV'}
            >
              <span className={[
                'block w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                webdavEnabled ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')} />
            </button>
          </div>

          {/* URL publique */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              URL publique du serveur
            </label>
            <input
              type="text"
              value={publicUrl}
              onChange={e => setPublicUrl(e.target.value)}
              placeholder="https://scrip.mondomaine.com"
              className="w-full h-10 px-3 rounded-lg text-[13px] font-mono
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.08] dark:border-white/[0.07]
                text-text-primary placeholder:text-text-tertiary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Identifiant
            </label>
            <input
              type="text"
              value={webdavUser}
              onChange={e => setWebdavUser(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-[13px]
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.08] dark:border-white/[0.07]
                text-text-primary
                focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
              Mot de passe {settings?.webdav?.hasPassword ? '(laisser vide pour ne pas changer)' : ''}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={webdavPass}
                  onChange={e => setWebdavPass(e.target.value)}
                  placeholder={settings?.webdav?.hasPassword ? '••••••••••••••••' : 'Définir un mot de passe'}
                  className="w-full h-10 px-3 pr-9 rounded-lg text-[13px]
                    bg-black/[0.04] dark:bg-white/[0.05]
                    border border-black/[0.08] dark:border-white/[0.07]
                    text-text-primary placeholder:text-text-tertiary
                    focus:outline-none focus:border-accent/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setWebdavPass(generatePassword()); setShowPass(true); }}
                className="h-10 px-3 rounded-lg text-[12px] font-medium
                  bg-black/[0.05] dark:bg-white/[0.07]
                  text-text-secondary hover:text-text-primary
                  hover:bg-black/[0.09] dark:hover:bg-white/[0.11]
                  transition-colors whitespace-nowrap"
              >
                Générer
              </button>
            </div>
          </div>

          {/* Bouton enregistrer */}
          <button
            onClick={saveWebdav}
            disabled={updateSettings.isPending}
            className="w-full h-10 rounded-lg text-[13px] font-medium
              bg-accent text-white hover:bg-accent/90
              disabled:opacity-40 transition-colors"
          >
            {webdavSaved ? '✓ Enregistré' : updateSettings.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>

          {/* URL WebDAV à copier dans Obsidian */}
          {webdavEnabled && webdavUrl && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">
                URL à coller dans Remotely Save
              </p>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                bg-black/[0.03] dark:bg-white/[0.04]
                border border-black/[0.06] dark:border-white/[0.05]">
                <code className="text-[12px] text-accent truncate">{webdavUrl}</code>
                <CopyButton text={webdavUrl} />
              </div>
            </div>
          )}

          {/* Snippet Nginx */}
          <details className="group">
            <summary className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium cursor-pointer select-none hover:text-text-secondary transition-colors">
              Config Nginx ▸
            </summary>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-tertiary">Ajouter dans ton bloc <code className="text-accent">server {'{}'}</code> :</p>
                <CopyButton text={nginxSnippet} />
              </div>
              <pre className="text-[11px] leading-relaxed p-3 rounded-lg overflow-x-auto
                bg-black/[0.04] dark:bg-white/[0.05]
                border border-black/[0.06] dark:border-white/[0.05]
                text-text-secondary font-mono">
                {nginxSnippet}
              </pre>
            </div>
          </details>

          {/* Guide Remotely Save */}
          <details className="group">
            <summary className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium cursor-pointer select-none hover:text-text-secondary transition-colors">
              Guide Obsidian Remotely Save ▸
            </summary>
            <ol className="mt-2 space-y-1.5 text-[12px] text-text-secondary list-decimal list-inside">
              <li>Installe le plugin <strong>Remotely Save</strong> dans Obsidian (Paramètres → Plugins tiers)</li>
              <li>Dans le plugin : choisir <strong>WebDAV</strong>, coller l'URL ci-dessus</li>
              <li>Entrer l'identifiant et le mot de passe configurés ici, puis cliquer <strong>Test</strong></li>
              <li>Lancer une première synchronisation manuelle</li>
            </ol>
          </details>
        </GlassCard>

        {/* ── Mot de passe ──────────────────────────────────────────────────── */}
        <GlassCard className="p-4 space-y-4">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-widest">Mot de passe</h3>
          <form onSubmit={handleChangePassword} className="space-y-3">
            {[
              { label: 'Mot de passe actuel',    value: currentPass, set: setCurrentPass, auto: 'current-password' },
              { label: 'Nouveau mot de passe',   value: newPass,     set: setNewPass,     auto: 'new-password'     },
              { label: 'Confirmer',              value: confirmPass, set: setConfirmPass, auto: 'new-password'     },
            ].map(({ label, value, set, auto }) => (
              <div key={label} className="space-y-1">
                <label className="text-[11px] uppercase tracking-wide text-text-tertiary font-medium">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={e => set(e.target.value)}
                  autoComplete={auto}
                  required
                  className="w-full h-10 px-3 rounded-lg text-[13px]
                    bg-black/[0.04] dark:bg-white/[0.05]
                    border border-black/[0.08] dark:border-white/[0.07]
                    text-text-primary placeholder:text-text-tertiary
                    focus:outline-none focus:border-accent/40 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            ))}
            {passError && <p className="text-red-500 text-[12px]">{passError}</p>}
            <button
              type="submit"
              disabled={passLoading}
              className="w-full h-10 rounded-lg text-[13px] font-medium
                bg-accent text-white hover:bg-accent/90
                disabled:opacity-40 transition-colors"
            >
              {passSaved ? '✓ Mot de passe mis à jour' : passLoading ? 'Enregistrement…' : 'Changer le mot de passe'}
            </button>
          </form>
        </GlassCard>

        {/* ── Déconnexion ───────────────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-medium
            text-red-500 bg-red-500/[0.08] hover:bg-red-500/[0.14]
            transition-colors"
        >
          <LogOut size={14} />
          Se déconnecter
        </button>

      </div>
    </div>
  );
}
