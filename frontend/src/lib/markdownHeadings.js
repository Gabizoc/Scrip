// Utilitaires de titres Markdown partagés entre le rendu, le sommaire et l'éditeur.

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function nodeToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (Array.isArray(node.children)) return node.children.map(nodeToText).join('');
  return '';
}

export function extractHeadings(markdown = '') {
  return markdown.split('\n').map(line => {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) return null;
    const text = m[2].trim()
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/`(.+?)`/g, '$1');
    return { level: m[1].length, text, id: slugify(text) };
  }).filter(Boolean);
}

export function stripFrontmatter(markdown = '') {
  return markdown.replace(/^---\n[\s\S]*?\n---\n*/m, '').trimStart();
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 88;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}
