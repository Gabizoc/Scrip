import { slugify, nodeToText } from '../../lib/markdownHeadings.js';

// Rendu des éléments Markdown (react-markdown) aux couleurs de l'app.
export const mdComponents = {
  h1: ({ children, node }) => (
    <h1 id={slugify(nodeToText(node))}
      className="text-2xl font-bold text-text-primary mt-8 mb-4 first:mt-0">
      {children}
    </h1>
  ), h2: ({ children, node }) => (
    <h2 id={slugify(nodeToText(node))}
      className="text-lg font-semibold text-text-primary mt-6 mb-3 ml-4
        border-l-[3px] border-accent pl-3 rounded-sm">
      {children}
    </h2>
  ), h3: ({ children, node }) => (
    <h3 id={slugify(nodeToText(node))}
      className="text-base font-semibold text-text-secondary mt-4 mb-2 ml-8
        border-l-2 border-accent/40 pl-3 rounded-sm">
      {children}
    </h3>
  ), h4: ({ children, node }) => (
    <h4 id={slugify(nodeToText(node))}
      className="text-sm font-semibold text-text-secondary mt-3 mb-1.5 ml-12
        border-l border-accent/25 pl-3">
      {children}
    </h4>
  ), h5: ({ children, node }) => (
    <h5 id={slugify(nodeToText(node))}
      className="text-sm font-medium text-text-tertiary mt-2 mb-1 ml-16 pl-3">
      {children}
    </h5>
  ), h6: ({ children, node }) => (
    <h6 id={slugify(nodeToText(node))}
      className="text-xs font-medium text-text-tertiary mt-2 mb-1 ml-20 pl-3">
      {children}
    </h6>
  ), p: ({ children }) => (
    <p className="text-[15px] text-text-primary leading-relaxed mb-3">{children}</p>
  ), ul: ({ children }) => <ul className="mb-3 space-y-1 pl-1">{children}</ul>, ol: ({ children }) => <ol className="mb-3 space-y-1 pl-1 list-decimal list-inside">{children}</ol>, li: ({ children }) => (
    <li className="text-[15px] text-text-primary leading-relaxed flex gap-2 items-start [&>ol]:mt-1 [&>ul]:mt-1">
      <span className="mt-[6px] shrink-0 w-1.5 h-1.5 rounded-full bg-accent/60" />
      <span>{children}</span>
    </li>
  ), strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>, em: ({ children }) => <em className="italic text-text-secondary">{children}</em>, hr: () => (
    <div className="my-6 flex items-center gap-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </div>
  ), table: ({ children }) => (
    <div className="table-scroll-wrapper my-4 overflow-x-auto rounded-lg border border-black/[0.08] dark:border-white/[0.08]"
      style={{ scrollbarGutter: 'stable' }}>
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ), thead: ({ children }) => <thead className="bg-accent/[0.08] dark:bg-accent/10">{children}</thead>, tbody: ({ children }) => <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">{children}</tbody>, tr: ({ children }) => <tr className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">{children}</tr>, th: ({ children }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  ), td: ({ children }) => (
    <td className="px-4 py-2.5 text-[14px] text-text-primary align-top">{children}</td>
  ), code: ({ children, className }) => {
    if (className) return (
      <pre className="my-3 p-4 rounded-lg bg-bg-elevated border border-black/[0.06] dark:border-white/[0.06] overflow-x-auto text-sm font-mono text-text-primary">
        <code>{children}</code>
      </pre>
    );
    return <code className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono text-[13px]">{children}</code>;
  }, blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 border-l-2 border-accent/40 text-text-secondary italic text-[14px]">
      {children}
    </blockquote>
  ),
};
