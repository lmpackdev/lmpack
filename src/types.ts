export type Format = 'md' | 'xml';

/** Why a file (or directory) did not make it into the pack. */
export type SkipReason =
  | 'ignored'
  | 'lockfile'
  | 'symlink'
  | 'secret'
  | 'size'
  | 'binary'
  | 'non-utf8'
  | 'empty'
  | 'long-line'
  | 'unreadable'
  | 'budget';

export interface Skipped {
  /** POSIX path relative to the pack root; directories end with `/`. */
  path: string;
  reason: SkipReason;
  /** Human-readable detail. Never contains file contents. */
  detail?: string;
  /** Tokens freed, for `budget` drops. */
  tokens?: number;
}

export interface Note {
  path: string;
  note: string;
}

export interface PackedFile {
  path: string;
  category: string;
  content: string;
  /** Tokens of the rendered file block (header, fence and content). */
  tokens: number;
}

export interface ResolvedOptions {
  /** Absolute path of the directory being packed. */
  root: string;
  include: string[];
  exclude: string[];
  budget: number | null;
  format: Format;
  /** Output file (absolute), or null for stdout. */
  out: string | null;
  /** Report file (absolute), or null for stderr (stdout in dry-run). */
  report: string | null;
  gitDiff: string | null;
  neighbors: boolean;
  tokenizer: string;
  maxFileSize: number;
  maxLineLength: number;
  allowSecrets: boolean;
  dryRun: boolean;
  priority: string[];
  categories: Array<[name: string, masks: string[]]>;
  profile: string | null;
}

export interface PackResult {
  /** The rendered pack. Present even in dry-run, so callers can inspect it. */
  output: string;
  /** Tokens of the whole rendered pack. */
  totalTokens: number;
  files: PackedFile[];
  skipped: Skipped[];
  notes: Note[];
  /** Counts of files that were walked but not selected by masks or git. */
  unselected: { excluded: number; notIncluded: number; unchanged: number };
  /** Set when even an empty pack does not fit the budget. */
  overBudget: boolean;
  options: ResolvedOptions;
}
