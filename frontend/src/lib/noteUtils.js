// frontend/src/lib/noteUtils.js

/** Parse "98/100" ou 98 → entier, ou null */
export function parseScore(raw) {
  if (raw == null) return null;
  const n = parseInt(String(raw).split('/')[0], 10);
  return isNaN(n) ? null : n;
}

/** Classe Tailwind de couleur selon le score */
export function scoreColor(s) {
  if (s >= 90) return 'text-status-success';
  if (s >= 70) return 'text-status-warning';
  return 'text-status-danger';
}

/** Palette de badges matière (bg + text) */
export const SUBJECT_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
];

/** Classe badge par hash du nom de matière */
export function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

/** Couleur CSS hex du dot matière (pour les pills) */
const DOT_COLORS = ['#7c7aff','#60a5fa','#34d399','#f59e0b','#f472b6','#22d3ee'];
export function subjectDotColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return DOT_COLORS[h % DOT_COLORS.length];
}

/** Emoji déterministe pour une matière */
const SUBJECT_ICONS = ['📜','🌍','🧬','⚖️','🔢','🔬','💬','🎨','🏛️','📐'];
export function subjectIcon(name = '', emoji = null) {
  if (emoji) return emoji;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SUBJECT_ICONS[h % SUBJECT_ICONS.length];
}

/** Date relative en français : "aujourd'hui", "il y a 3j", "il y a 2 sem", "il y a 1 mois" */
export function relativeDate(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days < 7)  return `il y a ${days}j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem`;
  return `il y a ${Math.floor(days / 30)} mois`;
}
