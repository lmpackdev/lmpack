/** Parse a token count: `120000`, `120k`, `1.5m`. `k` is 1000. */
export function parseTokens(value: string | number): number {
  if (typeof value === 'number') return checkPositive(value, String(value));
  const m = /^\s*(\d+(?:\.\d+)?)\s*([km]?)\s*$/i.exec(value);
  if (!m) throw new Error(`invalid token count "${value}" (expected e.g. 120000 or 120k)`);
  const mult = { '': 1, k: 1_000, m: 1_000_000 }[m[2]!.toLowerCase() as '' | 'k' | 'm'];
  return checkPositive(Math.round(Number(m[1]) * mult), value);
}

/** Parse a byte size: `262144`, `256kb`, `1mb`. `kb` is 1024. */
export function parseBytes(value: string | number): number {
  if (typeof value === 'number') return checkPositive(value, String(value));
  const m = /^\s*(\d+(?:\.\d+)?)\s*(b|k|kb|m|mb)?\s*$/i.exec(value);
  if (!m) throw new Error(`invalid size "${value}" (expected e.g. 262144, 256kb or 1mb)`);
  const unit = (m[2] ?? 'b').toLowerCase();
  const mult = unit.startsWith('m') ? 1024 * 1024 : unit.startsWith('k') ? 1024 : 1;
  return checkPositive(Math.round(Number(m[1]) * mult), value);
}

function checkPositive(n: number, raw: string): number {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`expected a positive number, got "${raw}"`);
  return n;
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
