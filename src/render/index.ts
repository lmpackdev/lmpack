import type { Format } from '../types.js';
import { markdown } from './markdown.js';
import { renderTree } from './tree.js';
import { xml } from './xml.js';

export interface Renderer {
  header(tree: string): string;
  file(f: { path: string; content: string }): string;
  footer(): string;
}

export const renderers: Record<Format, Renderer> = { md: markdown, xml };

export function renderPack(format: Format, files: Array<{ path: string; content: string }>): string {
  const r = renderers[format];
  const tree = files.length ? renderTree(files.map((f) => f.path)) : '(no files)';
  return r.header(tree) + files.map((f) => r.file(f)).join('') + r.footer();
}

export { renderTree };
