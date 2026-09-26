import { readdir, readFile, readlink, stat } from 'node:fs/promises';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';
import picomatch from 'picomatch';
import type { Skipped } from './types.js';

/** Directories never walked. VCS metadata is skipped silently. */
const VCS_DIRS = new Set(['.git', '.hg', '.svn']);
/** Directories skipped even without a .gitignore; reported. */
const BUILTIN_IGNORED_DIRS = new Set(['node_modules']);

const IGNORE_FILES = ['.gitignore', '.lmpackignore'];

interface Layer {
  /** Absolute directory the ignore file lives in. */
  base: string;
  ig: Ignore;
  /** Label for the report, e.g. `.gitignore` or `src/.lmpackignore`. */
  source: string;
}

export interface WalkResult {
  /** POSIX paths relative to root, sorted. */
  files: string[];
  skipped: Skipped[];
}

export interface WalkOptions {
  /** Absolute paths to skip silently (the pack and report outputs). */
  skipAbs?: string[];
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export async function walk(root: string, opts: WalkOptions = {}): Promise<WalkResult> {
  const files: string[] = [];
  const skipped: Skipped[] = [];
  const skipAbs = new Set((opts.skipAbs ?? []).map((p) => path.resolve(p)));

  const rootStat = await stat(root).catch(() => null);
  if (!rootStat?.isDirectory()) throw new Error(`not a directory: ${root}`);

  const parentLayers = await parentGitignores(root);

  async function visit(dirAbs: string, layers: Layer[]): Promise<void> {
    const own = await readLayers(root, dirAbs);
    const active = own.length ? [...layers, ...own] : layers;

    let entries;
    try {
      entries = await readdir(dirAbs, { withFileTypes: true });
    } catch (err) {
      skipped.push({ path: rel(root, dirAbs) + '/', reason: 'unreadable', detail: (err as Error).message });
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      const abs = path.join(dirAbs, entry.name);
      const relPath = rel(root, abs);
      if (skipAbs.has(abs)) continue;

      const isLink = entry.isSymbolicLink();
      const isDir = !isLink && entry.isDirectory();
      if (isDir && VCS_DIRS.has(entry.name)) continue;

      const ignoredBy = ignoredSource(active, abs, isDir);
      if (ignoredBy) {
        skipped.push({ path: isDir ? relPath + '/' : relPath, reason: 'ignored', detail: ignoredBy });
        continue;
      }
      if (isLink) {
        const target = await readlink(abs).catch(() => '?');
        skipped.push({ path: relPath, reason: 'symlink', detail: `-> ${toPosix(target)}, not followed` });
        continue;
      }
      if (isDir) {
        if (BUILTIN_IGNORED_DIRS.has(entry.name)) {
          skipped.push({ path: relPath + '/', reason: 'ignored', detail: 'built-in' });
          continue;
        }
        await visit(abs, active);
      } else if (entry.isFile()) {
        files.push(relPath);
      }
      // Sockets, FIFOs and devices are skipped silently.
    }
  }

  await visit(root, parentLayers);
  files.sort(comparePaths);
  return { files, skipped };
}

function rel(root: string, abs: string): string {
  return toPosix(path.relative(root, abs));
}

/** Byte-order comparison, so the order does not depend on locale. */
export function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function readLayers(root: string, dirAbs: string): Promise<Layer[]> {
  const layers: Layer[] = [];
  for (const name of IGNORE_FILES) {
    const layer = await readLayer(dirAbs, name, rel(root, path.join(dirAbs, name)));
    if (layer) layers.push(layer);
  }
  return layers;
}

async function readLayer(dirAbs: string, name: string, source: string): Promise<Layer | null> {
  let text: string;
  try {
    text = await readFile(path.join(dirAbs, name), 'utf8');
  } catch {
    return null;
  }
  return { base: dirAbs, ig: ignore().add(text.replace(/^﻿/, '')), source };
}

/**
 * When packing a subdirectory of a git repository, .gitignore files between
 * the repository root and the pack root still apply.
 */
async function parentGitignores(root: string): Promise<Layer[]> {
  const chain: string[] = [];
  let dir = path.dirname(root);
  let prev = root;
  let foundRepo = await exists(path.join(root, '.git'));
  while (!foundRepo && dir !== prev) {
    chain.unshift(dir);
    if (await exists(path.join(dir, '.git'))) foundRepo = true;
    prev = dir;
    dir = path.dirname(dir);
  }
  if (!foundRepo) return [];
  const layers: Layer[] = [];
  for (const d of chain) {
    const layer = await readLayer(d, '.gitignore', toPosix(path.relative(root, path.join(d, '.gitignore'))));
    if (layer) layers.push(layer);
  }
  return layers;
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  );
}

/** Git-like precedence: later (deeper) layers override earlier ones, `!` re-includes. */
function ignoredSource(layers: Layer[], abs: string, isDir: boolean): string | null {
  let source: string | null = null;
  for (const layer of layers) {
    const r = toPosix(path.relative(layer.base, abs));
    if (!r || r.startsWith('..')) continue;
    const res = layer.ig.test(isDir ? r + '/' : r);
    if (res.ignored) source = layer.source;
    else if (res.unignored) source = null;
  }
  return source;
}

/**
 * Build a predicate for `--include`/`--exclude` masks. Masks without a slash
 * match the file name at any depth (`*.ts`), others match the path from root.
 */
export function makeMatcher(masks: string[]): (p: string) => boolean {
  if (!masks.length) return () => false;
  const m = picomatch(masks, { dot: true, basename: true });
  return (p) => m(p);
}
