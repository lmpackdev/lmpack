import { describe, expect, it } from 'vitest';
import { packProject } from '../src/pack.js';
import { renderPack, renderTree } from '../src/render/index.js';
import { cdata } from '../src/render/xml.js';
import { fenceFor, languageFor } from '../src/render/markdown.js';
import { makeProject } from './helpers.js';

const files = [
  { path: 'README.md', content: '# Demo\n' },
  { path: 'src/a.ts', content: 'export const a = 1;' }, // no trailing newline
  { path: 'src/b.ts', content: 'export const b = 2;\n' },
];

const FENCE = '```';

describe('markdown', () => {
  it('renders the tree, then each file under a path heading', () => {
    expect(renderPack('md', files)).toBe(
      [
        '# Project files',
        '',
        '## Tree',
        '',
        `${FENCE}text`,
        'src/',
        '  a.ts',
        '  b.ts',
        'README.md',
        FENCE,
        '',
        '## README.md',
        '',
        `${FENCE}md`,
        '# Demo',
        FENCE,
        '',
        '## src/a.ts',
        '',
        `${FENCE}ts`,
        'export const a = 1;',
        FENCE,
        '',
        '## src/b.ts',
        '',
        `${FENCE}ts`,
        'export const b = 2;',
        FENCE,
        '',
      ].join('\n'),
    );
  });

  it('uses a longer fence when the content has backticks', () => {
    expect(fenceFor('no ticks')).toBe(FENCE);
    expect(fenceFor(`a ${FENCE} b`)).toBe('````');
    expect(fenceFor('`````')).toBe('``````');
  });

  it('picks a language by extension', () => {
    expect(languageFor('a/b.py')).toBe('python');
    expect(languageFor('Dockerfile')).toBe('dockerfile');
    expect(languageFor('LICENSE')).toBe('');
  });
});

describe('xml', () => {
  it('renders <files> with <file path> elements', () => {
    expect(renderPack('xml', files)).toBe(
      [
        '<pack>',
        '<tree>',
        'src/',
        '  a.ts',
        '  b.ts',
        'README.md',
        '</tree>',
        '<files>',
        '<file path="README.md"><![CDATA[',
        '# Demo',
        ']]></file>',
        '<file path="src/a.ts"><![CDATA[',
        'export const a = 1;',
        ']]></file>',
        '<file path="src/b.ts"><![CDATA[',
        'export const b = 2;',
        ']]></file>',
        '</files>',
        '</pack>',
        '',
      ].join('\n'),
    );
  });

  it('escapes attribute values and splits ]]> inside content', () => {
    const out = renderPack('xml', [{ path: 'a&b<c>.txt', content: 'x ]]> y\n' }]);
    expect(out).toContain('<file path="a&amp;b&lt;c&gt;.txt">');
    expect(cdata(']]>')).toBe('<![CDATA[]]]]><![CDATA[>]]>');
  });
});

describe('tree', () => {
  it('lists directories first and never shows empty ones', () => {
    expect(renderTree(['z.txt', 'a/b/c.ts', 'a/d.ts'])).toBe('a/\n  b/\n    c.ts\n  d.ts\nz.txt');
  });

  it('uses forward slashes in a real pack', async () => {
    const root = await makeProject({ 'src/deep/x.ts': 'x\n', 'src/empty-dir/.keep': '' });
    const r = await packProject({ path: root });
    expect(r.output).toContain('## src/deep/x.ts');
    expect(r.output).not.toContain('\\');
    expect(r.output).not.toContain('empty-dir');
  });
});
