import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Format, ResolvedOptions } from './types.js';
import { parseBytes, parseTokens } from './units.js';

export const CONFIG_FILE = 'lmpack.json';

export const DEFAULTS = {
  tokenizer: 'o200k',
  format: 'md' as Format,
  maxFileSize: 256 * 1024,
  maxLineLength: 1000,
  priority: ['src', 'lib', 'app', 'packages', '(root)', 'tests', 'test', 'docs'],
};

/** Settings shared by the top level of `lmpack.json` and its profiles. */
export interface ConfigSettings {
  include?: string[];
  exclude?: string[];
  budget?: string | number;
  tokenizer?: string;
  format?: Format;
  maxFileSize?: string | number;
  maxLineLength?: number;
  priority?: string[];
  categories?: Record<string, string[]>;
}

export interface ConfigFile extends ConfigSettings {
  profiles?: Record<string, ConfigSettings>;
}

/** Options as they come from the command line (or a library caller). */
export interface PackInput {
  path?: string;
  include?: string[];
  exclude?: string[];
  budget?: string | number;
  profile?: string;
  format?: string;
  out?: string;
  report?: string;
  gitDiff?: string;
  neighbors?: boolean;
  tokenizer?: string;
  maxFileSize?: string | number;
  maxLineLength?: number;
  allowSecrets?: boolean;
  dryRun?: boolean;
  /** Base for relative `path`, `out` and `report`. Defaults to process.cwd(). */
  cwd?: string;
}

export class ConfigError extends Error {}

const SETTING_KEYS = new Set([
  'include', 'exclude', 'budget', 'tokenizer', 'format',
  'maxFileSize', 'maxLineLength', 'priority', 'categories',
]);

export async function loadConfig(root: string): Promise<ConfigFile | null> {
  const file = path.join(root, CONFIG_FILE);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new ConfigError(`cannot read ${CONFIG_FILE}: ${(err as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    throw new ConfigError(`${CONFIG_FILE} is not valid JSON: ${(err as Error).message}`);
  }
  return validateConfig(data);
}

export function validateConfig(data: unknown): ConfigFile {
  if (!isObject(data)) throw new ConfigError(`${CONFIG_FILE}: top level must be an object`);
  const { profiles, ...rest } = data;
  const config: ConfigFile = validateSettings(rest, CONFIG_FILE);
  if (profiles !== undefined) {
    if (!isObject(profiles)) throw new ConfigError(`${CONFIG_FILE}: "profiles" must be an object`);
    config.profiles = {};
    for (const [name, value] of Object.entries(profiles)) {
      if (!isObject(value)) throw new ConfigError(`${CONFIG_FILE}: profile "${name}" must be an object`);
      config.profiles[name] = validateSettings(value, `profile "${name}"`);
    }
  }
  return config;
}

function validateSettings(obj: Record<string, unknown>, where: string): ConfigSettings {
  for (const key of Object.keys(obj)) {
    if (!SETTING_KEYS.has(key)) throw new ConfigError(`${where}: unknown key "${key}"`);
  }
  const s: ConfigSettings = {};
  for (const key of ['include', 'exclude', 'priority'] as const) {
    if (obj[key] !== undefined) s[key] = stringArray(obj[key], `${where}: "${key}"`);
  }
  if (obj.budget !== undefined) {
    s.budget = numOrString(obj.budget, `${where}: "budget"`);
    wrap(where, () => parseTokens(s.budget!));
  }
  if (obj.maxFileSize !== undefined) {
    s.maxFileSize = numOrString(obj.maxFileSize, `${where}: "maxFileSize"`);
    wrap(where, () => parseBytes(s.maxFileSize!));
  }
  if (obj.maxLineLength !== undefined) {
    if (typeof obj.maxLineLength !== 'number' || obj.maxLineLength <= 0) {
      throw new ConfigError(`${where}: "maxLineLength" must be a positive number`);
    }
    s.maxLineLength = obj.maxLineLength;
  }
  if (obj.tokenizer !== undefined) {
    if (typeof obj.tokenizer !== 'string') throw new ConfigError(`${where}: "tokenizer" must be a string`);
    s.tokenizer = obj.tokenizer;
  }
  if (obj.format !== undefined) s.format = parseFormat(obj.format, where);
  if (obj.categories !== undefined) {
    if (!isObject(obj.categories)) throw new ConfigError(`${where}: "categories" must be an object`);
    s.categories = {};
    for (const [name, masks] of Object.entries(obj.categories)) {
      s.categories[name] = stringArray(masks, `${where}: category "${name}"`);
    }
  }
  return s;
}

/** Merge CLI > profile > config top level > defaults. */
export async function resolveOptions(input: PackInput): Promise<ResolvedOptions> {
  const cwd = input.cwd ?? process.cwd();
  const root = path.resolve(cwd, input.path ?? '.');
  const config = (await loadConfig(root)) ?? {};

  let profile: ConfigSettings = {};
  if (input.profile) {
    const found = config.profiles?.[input.profile];
    if (!found) {
      const names = Object.keys(config.profiles ?? {});
      throw new ConfigError(
        `profile "${input.profile}" not found in ${CONFIG_FILE}` +
          (names.length ? ` (available: ${names.join(', ')})` : ''),
      );
    }
    profile = found;
  }

  const pick = <K extends keyof ConfigSettings>(key: K): ConfigSettings[K] => profile[key] ?? config[key];
  const nonEmpty = (a?: string[]) => (a && a.length ? a : undefined);

  const budgetRaw = input.budget ?? pick('budget');
  const sizeRaw = input.maxFileSize ?? pick('maxFileSize');
  const categories = pick('categories') ?? {};

  return {
    root,
    include: nonEmpty(input.include) ?? pick('include') ?? [],
    exclude: nonEmpty(input.exclude) ?? pick('exclude') ?? [],
    budget: budgetRaw === undefined ? null : parseTokens(budgetRaw),
    format: input.format !== undefined ? parseFormat(input.format, '--format') : (pick('format') ?? DEFAULTS.format),
    out: input.out ? path.resolve(cwd, input.out) : null,
    report: input.report ? path.resolve(cwd, input.report) : null,
    gitDiff: input.gitDiff ?? null,
    neighbors: input.neighbors ?? true,
    tokenizer: input.tokenizer ?? pick('tokenizer') ?? DEFAULTS.tokenizer,
    maxFileSize: sizeRaw === undefined ? DEFAULTS.maxFileSize : parseBytes(sizeRaw),
    maxLineLength: input.maxLineLength ?? pick('maxLineLength') ?? DEFAULTS.maxLineLength,
    allowSecrets: input.allowSecrets ?? false,
    dryRun: input.dryRun ?? false,
    priority: pick('priority') ?? DEFAULTS.priority,
    categories: Object.entries(categories),
    profile: input.profile ?? null,
  };
}

function parseFormat(value: unknown, where: string): Format {
  if (value === 'md' || value === 'markdown') return 'md';
  if (value === 'xml') return 'xml';
  throw new ConfigError(`${where}: format must be "md" or "xml", got "${String(value)}"`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringArray(v: unknown, where: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new ConfigError(`${where} must be an array of strings`);
  }
  return v as string[];
}

function numOrString(v: unknown, where: string): string | number {
  if (typeof v !== 'number' && typeof v !== 'string') throw new ConfigError(`${where} must be a number or string`);
  return v;
}

function wrap(where: string, fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    throw new ConfigError(`${where}: ${(err as Error).message}`);
  }
}
