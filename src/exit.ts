import type { PackResult } from './types.js';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_BUDGET = 2;

/** 2 when files were dropped to fit the budget, so scripts can notice. */
export function exitCodeFor(result: PackResult): number {
  return result.overBudget || result.skipped.some((s) => s.reason === 'budget') ? EXIT_BUDGET : EXIT_OK;
}
