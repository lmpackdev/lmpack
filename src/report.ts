import path from 'node:path';
import type { PackResult, Skipped } from './types.js';
import { formatInt } from './units.js';
import { VERSION } from './version.js';

const TOP_N = 10;

/** Plain-text report. Lists paths and reasons, never file contents. */
export function renderReport(result: PackResult): string {
  const { options: o, files, skipped, notes, unselected } = result;
  const out: string[] = [];
  const line = (s = '') => out.push(s);

  line(`lmpack ${VERSION} report${o.dryRun ? ' (dry run, pack not written)' : ''}`);
  line();
  const settings: Array<[string, string]> = [
    ['root', o.root.replaceAll(path.sep, '/')],
    ...(o.profile ? [['profile', o.profile] as [string, string]] : []),
    ...(o.gitDiff ? [['git-diff', `${o.gitDiff}${o.neighbors ? ' (+ neighbors)' : ''}`] as [string, string]] : []),
    ['tokenizer', o.tokenizer],
    ['format', o.format],
    ['budget', o.budget === null ? 'none' : `${formatInt(o.budget)} tokens`],
  ];
  for (const [k, v] of settings) line(`  ${k.padEnd(10)} ${v}`);
  line();

  const share = o.budget ? ` (${Math.round((result.totalTokens / o.budget) * 100)}% of budget)` : '';
  line(`Packed: ${files.length} file${files.length === 1 ? '' : 's'}, ${formatInt(result.totalTokens)} tokens${share}`);
  if (result.overBudget) {
    line(`WARNING: the pack exceeds the budget even with every file dropped; the budget is smaller than the pack's own framing.`);
  }

  if (files.length) {
    line();
    line(`Top ${Math.min(TOP_N, files.length)} files by tokens:`);
    const top = [...files].sort((a, b) => b.tokens - a.tokens || (a.path < b.path ? -1 : 1)).slice(0, TOP_N);
    const w = Math.max(...top.map((f) => formatInt(f.tokens).length));
    for (const f of top) line(`  ${formatInt(f.tokens).padStart(w)}  ${f.path}`);
  }

  const budgetDrops = skipped.filter((s) => s.reason === 'budget');
  if (budgetDrops.length) {
    const freed = budgetDrops.reduce((s, d) => s + (d.tokens ?? 0), 0);
    line();
    line(`Dropped by budget: ${budgetDrops.length} file${budgetDrops.length === 1 ? '' : 's'}, ${formatInt(freed)} tokens freed:`);
    const w = Math.max(...budgetDrops.map((d) => formatInt(d.tokens ?? 0).length));
    for (const d of budgetDrops) line(`  ${formatInt(d.tokens ?? 0).padStart(w)}  ${d.path}  (${d.detail})`);
  }

  const other = skipped.filter((s) => s.reason !== 'budget');
  if (other.length) {
    line();
    line(`Skipped: ${other.length}`);
    printTable(other, line);
  }

  if (notes.length) {
    line();
    line('Notes:');
    const w = Math.max(...notes.map((n) => n.path.length));
    for (const n of notes) line(`  ${n.path.padEnd(w)}  ${n.note}`);
  }

  const parts: string[] = [];
  if (unselected.notIncluded) parts.push(`${unselected.notIncluded} not matching --include`);
  if (unselected.excluded) parts.push(`${unselected.excluded} matching --exclude`);
  if (unselected.unchanged) parts.push(`${unselected.unchanged} unchanged since ${o.gitDiff}`);
  if (parts.length) {
    line();
    line(`Not selected: ${parts.join(', ')}.`);
  }
  return out.join('\n') + '\n';
}

function printTable(rows: Skipped[], line: (s: string) => void): void {
  const order = ['secret', 'ignored', 'lockfile', 'symlink', 'size', 'binary', 'non-utf8', 'long-line', 'empty', 'unreadable'];
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.reason) - order.indexOf(b.reason) || (a.path < b.path ? -1 : 1),
  );
  const rw = Math.max(...sorted.map((r) => r.reason.length));
  const pw = Math.min(60, Math.max(...sorted.map((r) => r.path.length)));
  for (const r of sorted) {
    line(`  ${r.reason.padEnd(rw)}  ${r.path.padEnd(pw)}${r.detail ? '  ' + r.detail : ''}`.trimEnd());
  }
}
