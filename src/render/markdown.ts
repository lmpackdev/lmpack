import type { Renderer } from './index.js';

const LANG: Record<string, string> = {
  ts: 'ts', tsx: 'tsx', mts: 'ts', cts: 'ts', js: 'js', jsx: 'jsx', mjs: 'js', cjs: 'js',
  json: 'json', jsonc: 'jsonc', md: 'md', mdx: 'mdx', py: 'python', rb: 'ruby', go: 'go',
  rs: 'rust', java: 'java', kt: 'kotlin', kts: 'kotlin', swift: 'swift', c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', sh: 'bash', bash: 'bash',
  zsh: 'bash', ps1: 'powershell', sql: 'sql', html: 'html', htm: 'html', css: 'css',
  scss: 'scss', less: 'less', vue: 'vue', svelte: 'svelte', astro: 'astro', yml: 'yaml',
  yaml: 'yaml', toml: 'toml', ini: 'ini', xml: 'xml', svg: 'xml', graphql: 'graphql',
  gql: 'graphql', proto: 'protobuf', lua: 'lua', dart: 'dart', scala: 'scala', r: 'r',
  ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell', clj: 'clojure', tf: 'hcl',
  dockerfile: 'dockerfile', makefile: 'makefile',
};

export function languageFor(filePath: string): string {
  const base = filePath.slice(filePath.lastIndexOf('/') + 1).toLowerCase();
  if (base === 'dockerfile' || base === 'makefile') return base;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? (LANG[base.slice(dot + 1)] ?? '') : '';
}

/** A fence longer than any backtick run inside the content. */
export function fenceFor(content: string): string {
  let longest = 0;
  for (const m of content.matchAll(/`+/g)) longest = Math.max(longest, m[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
}

function withTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : s + '\n';
}

export const markdown: Renderer = {
  header(tree) {
    const fence = fenceFor(tree);
    return `# Project files\n\n## Tree\n\n${fence}text\n${withTrailingNewline(tree)}${fence}\n`;
  },
  file(f) {
    const fence = fenceFor(f.content);
    return `\n## ${f.path}\n\n${fence}${languageFor(f.path)}\n${withTrailingNewline(f.content)}${fence}\n`;
  },
  footer() {
    return '';
  },
};
