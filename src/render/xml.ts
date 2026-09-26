import type { Renderer } from './index.js';

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Wrap in CDATA, splitting any `]]>` inside the content. */
export function cdata(s: string): string {
  return `<![CDATA[${s.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

function withTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : s + '\n';
}

export const xml: Renderer = {
  header(tree) {
    return `<pack>\n<tree>\n${withTrailingNewline(escapeXml(tree))}</tree>\n<files>\n`;
  },
  file(f) {
    return `<file path="${escapeXml(f.path)}">${cdata('\n' + withTrailingNewline(f.content))}</file>\n`;
  },
  footer() {
    return '</files>\n</pack>\n';
  },
};
