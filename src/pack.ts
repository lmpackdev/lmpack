import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fitBudget, makeCategorizer, NEIGHBORS_CATEGORY } from './budget.js';
import { resolveOptions, type PackInput } from './config.js';
import { decodeContent } from './content.js';
import { changedFiles, dirOf } from './git.js';
import { secretByContent, secretByName } from './guard.js';
import { renderers } from './render/index.js';
import { loadTokenizer } from './tokenize.js';
import type { Note, PackedFile, PackResult, ResolvedOptions, Skipped } from './types.js';
import { formatBytes } from './units.js';
import { makeMatcher, walk } from './walk.js';

/** Resolve options from `lmpack.json` and the given overrides, then pack. */
export async function packProject(input: PackInput = {}): Promise<PackResult> {
  return pack(await resolveOptions(input));
}

export async function pack(options: ResolvedOptions): Promise<PackResult> {
  const tokenizer = await loadTokenizer(options.tokenizer);
  const o: ResolvedOptions = { ...options, tokenizer: tokenizer.name };

  const walked = await walk(o.root, { skipAbs: [o.out, o.report].filter((p): p is string => !!p) });
  const skipped: Skipped[] = [...walked.skipped];
  const notes: Note[] = [];
  const unselected = { excluded: 0, notIncluded: 0, unchanged: 0 };

  // Selection by masks.
  const included = makeMatcher(o.include);
  const excluded = makeMatcher(o.exclude);
  let selected = walked.files.filter((p) => {
    if (o.include.length && !included(p)) return unselected.notIncluded++, false;
    if (excluded(p)) return unselected.excluded++, false;
    return true;
  });

  // Selection by git.
  const neighbors = new Set<string>();
  if (o.gitDiff) {
    const changed = await changedFiles(o.root, o.gitDiff);
    const changedDirs = new Set([...changed].map(dirOf));
    selected = selected.filter((p) => {
      if (changed.has(p)) return true;
      if (o.neighbors && changedDirs.has(dirOf(p))) return neighbors.add(p), true;
      return unselected.unchanged++, false;
    });
  }

  const categorize = makeCategorizer(o.categories);
  const renderer = renderers[o.format];
  const candidates: PackedFile[] = [];

  for (const p of selected) {
    const result = await loadFile(o, p);
    if ('reason' in result) {
      skipped.push(result);
      continue;
    }
    if (result.bomStripped) notes.push({ path: p, note: 'UTF-8 byte-order mark stripped' });
    const content = result.text;
    candidates.push({
      path: p,
      category: neighbors.has(p) ? NEIGHBORS_CATEGORY : categorize(p),
      content,
      tokens: tokenizer.count(renderer.file({ path: p, content })),
    });
  }

  const fit = fitBudget(candidates, {
    budget: o.budget,
    format: o.format,
    priority: o.priority,
    count: tokenizer.count,
  });

  return {
    output: fit.output,
    totalTokens: fit.totalTokens,
    files: fit.kept,
    skipped: [...skipped, ...fit.dropped],
    notes,
    unselected,
    overBudget: fit.overBudget,
    options: o,
  };
}

async function loadFile(
  o: ResolvedOptions,
  p: string,
): Promise<Skipped | { text: string; bomStripped: boolean }> {
  if (!o.allowSecrets) {
    const why = secretByName(p);
    if (why) return { path: p, reason: 'secret', detail: why };
  }
  const abs = path.join(o.root, p);
  let buf: Buffer;
  try {
    const st = await stat(abs);
    if (st.size > o.maxFileSize) {
      return { path: p, reason: 'size', detail: `${formatBytes(st.size)} > ${formatBytes(o.maxFileSize)}` };
    }
    buf = await readFile(abs);
  } catch (err) {
    return { path: p, reason: 'unreadable', detail: (err as NodeJS.ErrnoException).code ?? (err as Error).message };
  }
  const decoded = decodeContent(buf, o.maxLineLength);
  if (!decoded.ok) return { path: p, reason: decoded.reason, ...(decoded.detail ? { detail: decoded.detail } : {}) };
  if (!o.allowSecrets) {
    const why = secretByContent(decoded.text);
    if (why) return { path: p, reason: 'secret', detail: why };
  }
  return { text: decoded.text, bomStripped: decoded.bomStripped };
}
