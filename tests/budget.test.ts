import { describe, expect, it } from 'vitest';
import { dropOrder, fitBudget, makeCategorizer } from '../src/budget.js';
import { exitCodeFor } from '../src/exit.js';
import { packProject } from '../src/pack.js';
import { loadTokenizer } from '../src/tokenize.js';
import type { PackedFile } from '../src/types.js';
import { makeProject } from './helpers.js';

/** Roughly `n` words of varied text, ten per line. */
const words = (n: number, seed = 'w') =>
  Array.from({ length: n }, (_, i) => `${seed}${i}${i % 10 === 9 ? '\n' : ' '}`).join('') + '\n';

const file = (path: string, category: string, tokens: number): PackedFile => ({ path, category, content: '', tokens });

describe('categories and drop order', () => {
  it('categorizes by the first matching mask, else by top-level directory', () => {
    const cat = makeCategorizer([
      ['core', ['src/core/**']],
      ['code', ['src/**', 'lib/**']],
    ]);
    expect(cat('src/core/a.ts')).toBe('core');
    expect(cat('src/b.ts')).toBe('code');
    expect(cat('docs/x.md')).toBe('docs');
    expect(cat('README.md')).toBe('(root)');
  });

  it('drops the least important category first, largest file first within it', () => {
    const files = [
      file('src/a', 'src', 10),
      file('src/b', 'src', 50),
      file('docs/a', 'docs', 5),
      file('docs/b', 'docs', 30),
      file('misc/a', 'misc', 1),
      file('lib/n', 'neighbors', 2),
    ];
    expect(dropOrder(files, ['src', 'docs']).map((f) => f.path)).toEqual([
      'lib/n', // git neighbors go first
      'misc/a', // categories missing from priority go next
      'docs/b',
      'docs/a',
      'src/b',
      'src/a',
    ]);
  });
});

describe('fitBudget', () => {
  it('restores smaller files after a large one is dropped', async () => {
    const tok = await loadTokenizer('o200k');
    const mk = (path: string, category: string, content: string): PackedFile => ({
      path,
      category,
      content,
      tokens: tok.count(`\n## ${path}\n\n\`\`\`\n${content}\`\`\`\n`),
    });
    const files = [
      mk('docs/huge.md', 'docs', words(2000, 'h')),
      mk('docs/small.md', 'docs', words(50, 's')),
      mk('src/a.ts', 'src', words(100, 'a')),
    ];
    const fit = fitBudget(files, { budget: 500, format: 'md', priority: ['src', 'docs'], count: tok.count });
    expect(fit.kept.map((f) => f.path)).toEqual(['docs/small.md', 'src/a.ts']);
    expect(fit.dropped.map((d) => d.path)).toEqual(['docs/huge.md']);
    expect(fit.totalTokens).toBeLessThanOrEqual(500);
  });
});

describe('budget in a pack', () => {
  // o200k sizes: main 630, util 420, guide 840, faq 210, README 105 tokens.
  const tree = {
    'src/main.ts': words(300, 'm'),
    'src/util.ts': words(200, 'u'),
    'docs/guide.md': words(400, 'g'),
    'docs/faq.md': words(100, 'f'),
    'README.md': words(50, 'r'),
  };

  it.each(['md', 'xml'] as const)('never exceeds the budget (%s)', async (format) => {
    const root = await makeProject(tree);
    const tok = await loadTokenizer('o200k');
    for (const budget of [100, 400, 700, 1000, 1400]) {
      const r = await packProject({ path: root, budget, format });
      expect(r.totalTokens).toBeLessThanOrEqual(budget);
      expect(tok.count(r.output)).toBe(r.totalTokens);
    }
  });

  it('drops docs before sources and reports freed tokens', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, budget: 1300 });
    expect(r.files.map((f) => f.path)).toContain('src/main.ts');
    const dropped = r.skipped.filter((s) => s.reason === 'budget');
    expect(dropped.map((d) => d.path)).toContain('docs/guide.md');
    expect(dropped.every((d) => (d.tokens ?? 0) > 0)).toBe(true);
    expect(exitCodeFor(r)).toBe(2);
  });

  it('honors priority from lmpack.json', async () => {
    const root = await makeProject({ ...tree, 'lmpack.json': JSON.stringify({ priority: ['docs', 'src'] }) });
    const r = await packProject({ path: root, budget: 1300 });
    expect(r.files.map((f) => f.path)).toContain('docs/guide.md');
    expect(r.skipped.filter((s) => s.reason === 'budget').map((d) => d.path)).toContain('src/main.ts');
  });

  it('exits 0 when everything fits', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, budget: '100k' });
    expect(r.files).toHaveLength(5);
    expect(exitCodeFor(r)).toBe(0);
  });
});
