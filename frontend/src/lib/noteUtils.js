export function parseScore(raw) {
  if (raw == null) return null;
  const n = parseInt(String(raw).split('/')[0], 10);
  return isNaN(n) ? null : n;
}

export function scoreColor(s) {
  if (s >= 90) return 'text-status-success';
  if (s >= 70) return 'text-status-warning';
  return 'text-status-danger';
}

export const SUBJECT_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
];

export function subjectColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

const DOT_COLORS = ['#7c7aff','#60a5fa','#34d399','#f59e0b','#f472b6','#22d3ee'];
export function subjectDotColor(name = '', hex = null) {
  if (hex) return hex;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return DOT_COLORS[h % DOT_COLORS.length];
}

export function subjectColorStyle(hex = null) {
  if (!hex) return null;
  return {
    background: hex + '22',
    color: hex,
    border: `1px solid ${hex}44`,
  };
}

const SUBJECT_ICONS = ['📜','🌍','🧬','⚖️','🔢','🔬','💬','🎨','🏛️','📐'];
export function subjectIcon(name = '', emoji = null) {
  if (emoji) return emoji;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SUBJECT_ICONS[h % SUBJECT_ICONS.length];
}

export function relativeDate(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days < 7)  return `il y a ${days}j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} sem`;
  return `il y a ${Math.floor(days / 30)} mois`;
}
