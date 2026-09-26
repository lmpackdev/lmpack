import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export class GitError extends Error {}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === 'ENOENT') throw new GitError('git executable not found in PATH (needed for --git-diff)');
    throw new GitError((e.stderr || e.message).trim());
  }
}

/**
 * Files under `root` that differ from `ref`: committed changes since the
 * merge base with `ref`, uncommitted changes, and untracked files that are
 * not ignored. Paths are POSIX, relative to `root`.
 */
export async function changedFiles(root: string, ref: string): Promise<Set<string>> {
  if (!ref || ref.startsWith('-')) throw new GitError(`invalid git ref "${ref}"`);
  await git(root, ['rev-parse', '--is-inside-work-tree']).catch(() => {
    throw new GitError(`${root} is not inside a git repository (needed for --git-diff)`);
  });
  await git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).catch(() => {
    throw new GitError(`git ref "${ref}" not found`);
  });
  const diff = await git(root, ['diff', '--name-only', '-z', '--relative', '--merge-base', ref]);
  const untracked = await git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  return new Set([...diff.split('\0'), ...untracked.split('\0')].filter(Boolean));
}

/** Directory of a POSIX path, '' for the root. */
export function dirOf(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}
