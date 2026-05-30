export function buildNote(content, meta) {
  const sourcesInline = (meta.sources ?? []).join(', ');
  const frontmatter = [
    '---',
    `matière: ${meta.subject}`,
    `niveau: ${meta.level}`,
    `date_cours: ${meta.dateCours}`,
    `date_ingestion: ${meta.dateIngestion}`,
    `tags: [cours, ${meta.subject}, ${meta.level.replace(/\s+/g, '-')}]`,
    `sources: [${sourcesInline}]`,
    '---',
  ].join('\n');

  return `${frontmatter}\n\n${content}\n`;
}
