export interface Tokenizer {
  name: string;
  count(text: string): number;
}

/** Short name → gpt-tokenizer encoding. Full encoding names are accepted too. */
export const TOKENIZERS: Record<string, { encoding: string; about: string }> = {
  o200k: { encoding: 'o200k_base', about: 'GPT-4o, GPT-4.1, GPT-5, o-series (default)' },
  cl100k: { encoding: 'cl100k_base', about: 'GPT-4, GPT-3.5-turbo' },
  p50k: { encoding: 'p50k_base', about: 'Codex, text-davinci-002/003' },
  r50k: { encoding: 'r50k_base', about: 'GPT-3' },
};

type Encoding = {
  countTokens(text: string, opts?: { disallowedSpecial?: Set<string> }): number;
};

const loaders: Record<string, () => Promise<Encoding>> = {
  o200k_base: () => import('gpt-tokenizer/encoding/o200k_base'),
  cl100k_base: () => import('gpt-tokenizer/encoding/cl100k_base'),
  p50k_base: () => import('gpt-tokenizer/encoding/p50k_base'),
  r50k_base: () => import('gpt-tokenizer/encoding/r50k_base'),
};

export function resolveTokenizerName(name: string): string {
  const key = name.toLowerCase();
  const short = TOKENIZERS[key] ? key : Object.keys(TOKENIZERS).find((k) => TOKENIZERS[k]!.encoding === key);
  if (!short) {
    throw new Error(`unknown tokenizer "${name}" (available: ${Object.keys(TOKENIZERS).join(', ')})`);
  }
  return short;
}

export async function loadTokenizer(name: string): Promise<Tokenizer> {
  const short = resolveTokenizerName(name);
  const enc = await loaders[TOKENIZERS[short]!.encoding]!();
  // Special-token strings like <|endoftext|> in source files are plain text to us.
  const opts = { disallowedSpecial: new Set<string>() };
  return { name: short, count: (text) => enc.countTokens(text, opts) };
}
