import { makeMatcher } from './walk.js';
import { renderPack, renderers, renderTree } from './render/index.js';
import type { Format, PackedFile, Skipped } from './types.js';

export const ROOT_CATEGORY = '(root)';
export const NEIGHBORS_CATEGORY = 'neighbors';

/** First matching `categories` entry wins; otherwise the top-level directory. */
export function makeCategorizer(categories: Array<[string, string[]]>): (p: string) => string {
  const matchers = categories.map(([name, masks]) => ({ name, match: makeMatcher(masks) }));
  return (p) => {
    const hit = matchers.find((m) => m.match(p));
    if (hit) return hit.name;
    const slash = p.indexOf('/');
    return slash === -1 ? ROOT_CATEGORY : p.slice(0, slash);
  };
}

/**
 * Files in the order they are dropped: categories from the end of `priority`
 * first (unlisted categories before listed ones, git neighbors before all),
 * largest files first within a category.
 */
export function dropOrder(files: PackedFile[], priority: string[]): PackedFile[] {
  const rank = (cat: string) => {
    if (cat === NEIGHBORS_CATEGORY) return priority.length + 1;
    const i = priority.indexOf(cat);
    return i === -1 ? priority.length : i;
  };
  return [...files].sort(
    (a, b) => rank(b.category) - rank(a.category) || b.tokens - a.tokens || (a.path < b.path ? -1 : 1),
  );
}

export interface FitResult {
  kept: PackedFile[];
  dropped: Skipped[];
  output: string;
  totalTokens: number;
  overBudget: boolean;
}

/**
 * Drop files until the rendered pack fits the budget.
 *
 * 1. Drop in `dropOrder` until the estimate fits.
 * 2. Walk the dropped files back from the most important one and restore
 *    each that still fits, so one huge low-value file does not take a whole
 *    category of small ones with it.
 * 3. Per-file costs are estimates (tokens do not add up exactly across
 *    boundaries), so the final pack is re-counted and trimmed further if needed.
 */
export function fitBudget(
  files: PackedFile[],
  opts: { budget: number | null; format: Format; priority: string[]; count: (s: string) => number },
): FitResult {
  const { budget, format, count } = opts;
  const render = (list: PackedFile[]) => renderPack(format, list);

  if (budget === null) {
    const output = render(files);
    return { kept: files, dropped: [], output, totalTokens: count(output), overBudget: false };
  }

  const r = renderers[format];
  // The tree of all files; it only shrinks as files are dropped, so this errs on the safe side.
  const overhead = count(r.header(renderTree(files.map((f) => f.path))) + r.footer());
  let estimate = overhead + files.reduce((s, f) => s + f.tokens, 0);

  const order = dropOrder(files, opts.priority);
  const dropped = new Set<PackedFile>();

  for (const f of order) {
    if (estimate <= budget) break;
    dropped.add(f);
    estimate -= f.tokens;
  }
  for (const f of [...dropped].reverse()) {
    if (estimate + f.tokens <= budget) {
      dropped.delete(f);
      estimate += f.tokens;
    }
  }

  for (;;) {
    const kept = files.filter((f) => !dropped.has(f));
    const output = render(kept);
    const totalTokens = count(output);
    const next = order.find((f) => !dropped.has(f));
    if (totalTokens <= budget || !next) {
      const skipped: Skipped[] = order
        .filter((f) => dropped.has(f))
        .map((f) => ({ path: f.path, reason: 'budget', detail: `category ${f.category}`, tokens: f.tokens }));
      return { kept, dropped: skipped, output, totalTokens, overBudget: totalTokens > budget };
    }
    dropped.add(next);
  }
}
