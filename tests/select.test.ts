import { symlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { packProject } from '../src/pack.js';
import { walk } from '../src/walk.js';
import { makeProject } from './helpers.js';

const paths = (r: { files: Array<{ path: string }> }) => r.files.map((f) => f.path);

describe('selection by masks', () => {
  const tree = {
    'src/a.ts': 'a\n',
    'src/a.test.ts': 't\n',
    'src/sub/b.ts': 'b\n',
    'docs/guide.md': 'g\n',
    'README.md': 'r\n',
  };

  it('packs everything by default, sorted by path', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root });
    expect(paths(r)).toEqual(['README.md', 'docs/guide.md', 'src/a.test.ts', 'src/a.ts', 'src/sub/b.ts']);
  });

  it('applies --include and --exclude', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, include: ['src/**'], exclude: ['*.test.ts'] });
    expect(paths(r)).toEqual(['src/a.ts', 'src/sub/b.ts']);
    expect(r.unselected).toMatchObject({ notIncluded: 2, excluded: 1 });
  });

  it('matches masks without a slash against the file name', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, include: ['*.md'] });
    expect(paths(r)).toEqual(['README.md', 'docs/guide.md']);
  });
});

describe('lock files', () => {
  const tree = {
    'package.json': '{}\n',
    'package-lock.json': '{"lockfileVersion": 3}\n',
    'src/a.ts': 'a\n',
    'rust/Cargo.lock': 'version = 3\n',
  };

  it('skips lock files by default and says why', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root });
    expect(paths(r)).toEqual(['package.json', 'src/a.ts']);
    expect(r.skipped).toEqual([
      { path: 'package-lock.json', reason: 'lockfile', detail: 'pass --include to pack it' },
      { path: 'rust/Cargo.lock', reason: 'lockfile', detail: 'pass --include to pack it' },
    ]);
  });

  it('packs a lock file named by --include', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, include: ['package-lock.json', 'src/**'] });
    expect(paths(r)).toEqual(['package-lock.json', 'src/a.ts']);
  });

  it('still skips lock files that --include does not match', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, include: ['src/**', 'package.json'] });
    expect(paths(r)).toEqual(['package.json', 'src/a.ts']);
    expect(r.skipped.filter((s) => s.reason === 'lockfile')).toEqual([]);
  });
});

describe('ignore files', () => {
  it('honors .gitignore, nested .lmpackignore and negation', async () => {
    const root = await makeProject({
      '.gitignore': 'build/\n*.log\n!keep.log\n',
      'build/out.js': 'x\n',
      'app.log': 'x\n',
      'keep.log': 'k\n',
      'src/.lmpackignore': 'fixtures/\n',
      'src/fixtures/big.json': '{}\n',
      'src/index.ts': 'i\n',
    });
    const w = await walk(root);
    expect(w.files).toEqual(['.gitignore', 'keep.log', 'src/.lmpackignore', 'src/index.ts']);
    expect(w.skipped).toEqual(
      expect.arrayContaining([
        { path: 'build/', reason: 'ignored', detail: '.gitignore' },
        { path: 'app.log', reason: 'ignored', detail: '.gitignore' },
        { path: 'src/fixtures/', reason: 'ignored', detail: 'src/.lmpackignore' },
      ]),
    );
  });

  it('skips node_modules and .git without a .gitignore', async () => {
    const root = await makeProject({
      'node_modules/x/index.js': 'x\n',
      '.git/HEAD': 'ref\n',
      'a.ts': 'a\n',
    });
    const w = await walk(root);
    expect(w.files).toEqual(['a.ts']);
    expect(w.skipped).toEqual([{ path: 'node_modules/', reason: 'ignored', detail: 'built-in' }]);
  });

  it('does not pack its own output file', async () => {
    const root = await makeProject({ 'a.ts': 'a\n', 'pack.md': 'old pack\n' });
    const r = await packProject({ path: root, out: path.join(root, 'pack.md') });
    expect(paths(r)).toEqual(['a.ts']);
  });
});

describe('symlinks', () => {
  it('does not follow a directory link that forms a cycle', async () => {
    const root = await makeProject({ 'real/a.ts': 'a\n' });
    // 'junction' needs no privileges on Windows and is ignored elsewhere.
    await symlink(root, path.join(root, 'real', 'loop'), 'junction');
    const w = await walk(root);
    expect(w.files).toEqual(['real/a.ts']);
    expect(w.skipped.map((s) => [s.path, s.reason])).toEqual([['real/loop', 'symlink']]);
  });

  it('reports file symlinks without reading them', async (ctx) => {
    const root = await makeProject({ 'real/a.ts': 'a\n' });
    try {
      await symlink(path.join(root, 'real', 'a.ts'), path.join(root, 'link.ts'), 'file');
    } catch (err) {
      // Windows without Developer Mode cannot create file symlinks.
      if ((err as NodeJS.ErrnoException).code === 'EPERM') return ctx.skip();
      throw err;
    }
    const w = await walk(root);
    expect(w.files).toEqual(['real/a.ts']);
    expect(w.skipped).toMatchObject([{ path: 'link.ts', reason: 'symlink' }]);
  });
});
