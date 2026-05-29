import { useState, useEffect } from 'react';

/**
 * Gère le thème dark/light/auto.
 * - Lit depuis localStorage ('scrip.theme')
 * - Applique/retire la classe .dark sur <html>
 * - En mode 'auto' : écoute prefers-color-scheme en temps réel
 */
export function useTheme() {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('scrip.theme') ?? 'auto'
  );

  function applyTheme(t) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = t === 'dark' || (t === 'auto' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  }

  function setTheme(t) {
    localStorage.setItem('scrip.theme', t);
    setThemeState(t);
    applyTheme(t);
  }

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme };
}
