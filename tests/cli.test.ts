import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeProject } from './helpers.js';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const exec = promisify(execFile);

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

async function lmpack(args: string[], cwd?: string): Promise<Run> {
  try {
    const { stdout, stderr } = await exec(process.execPath, [CLI, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

async function git(cwd: string, ...args: string[]) {
  await exec('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd });
}

beforeAll(() => {
  if (!existsSync(CLI)) throw new Error('dist/cli.js is missing; run "npm run build" first');
});

describe('cli', () => {
  it('prints help that explains flags and exit codes', async () => {
    const top = await lmpack([]);
    expect(top.code).toBe(0);
    expect(top.stdout).toContain('lmpack pack --budget 120k');

    const help = await lmpack(['pack', '--help']);
    expect(help.code).toBe(0);
    for (const flag of [
      '--include', '--exclude', '--budget', '--profile', '--format', '--out', '--git-diff',
      '--tokenizer', '--max-file-size', '--allow-secrets', '--dry-run', '--report',
    ]) {
      expect(help.stdout).toContain(flag);
    }
    expect(help.stdout).toContain('Exit codes');
  });

  it('packs to stdout and reports to stderr', async () => {
    const root = await makeProject({ 'a.ts': 'export const a = 1;\n' });
    const r = await lmpack(['pack', root]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('## a.ts');
    expect(r.stderr).toContain('Packed: 1 file');
  });

  it('works on an empty directory', async () => {
    const root = await makeProject();
    const r = await lmpack(['pack', root, '--format', 'xml']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('<files>');
    expect(r.stderr).toContain('Packed: 0 files');
  });

  it('writes nothing to disk with --dry-run', async () => {
    const root = await makeProject({ 'a.ts': 'a\n' });
    const before = await readdir(root);
    const r = await lmpack(['pack', '.', '--dry-run', '--out', 'pack.md'], root);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('dry run');
    expect(await readdir(root)).toEqual(before);
  });

  it('writes --out and --report files', async () => {
    const root = await makeProject({ 'a.ts': 'a\n' });
    const r = await lmpack(['pack', '.', '--out', 'out/pack.xml', '--format', 'xml', '--report', 'report.txt'], root);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
    expect(await readFile(path.join(root, 'out', 'pack.xml'), 'utf8')).toContain('<file path="a.ts">');
    expect(await readFile(path.join(root, 'report.txt'), 'utf8')).toContain('Packed: 1 file');
  });

  it('exits 2 when files are dropped by budget', async () => {
    const big = Array.from({ length: 500 }, (_, i) => `word${i}${i % 10 === 9 ? '\n' : ' '}`).join('');
    const root = await makeProject({ 'src/a.ts': 'a\n', 'docs/big.md': big });
    const r = await lmpack(['pack', root, '--budget', '200']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('Dropped by budget: 1 file');
  });

  it('exits 1 on errors', async () => {
    const root = await makeProject({ 'a.ts': 'a\n' });
    expect((await lmpack(['pack', root, '--profile', 'missing'])).code).toBe(1);
    expect((await lmpack(['pack', root, '--budget', 'lots'])).code).toBe(1);
    expect((await lmpack(['pack', path.join(root, 'nope')])).code).toBe(1);
    const bad = await lmpack(['pack', root, '--format', 'html']);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('html');
  });

  it('packs files changed since a git ref, with neighbors', async () => {
    const root = await makeProject({ 'src/a.ts': 'a\n', 'src/b.ts': 'b\n', 'lib/c.ts': 'c\n' });
    await git(root, 'init', '-q', '-b', 'main');
    await git(root, 'add', '-A');
    await git(root, 'commit', '-qm', 'init');
    await git(root, 'checkout', '-qb', 'feature');
    await writeFile(path.join(root, 'src', 'a.ts'), 'a changed\n');

    const withNeighbors = await lmpack(['pack', root, '--git-diff', 'main']);
    expect(withNeighbors.stdout).toContain('## src/a.ts');
    expect(withNeighbors.stdout).toContain('## src/b.ts');
    expect(withNeighbors.stdout).not.toContain('## lib/c.ts');

    const only = await lmpack(['pack', root, '--git-diff', 'main', '--no-neighbors']);
    expect(only.stdout).toContain('## src/a.ts');
    expect(only.stdout).not.toContain('## src/b.ts');

    expect((await lmpack(['pack', root, '--git-diff', 'no-such-ref'])).code).toBe(1);
  });
});
