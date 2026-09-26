import picomatch from 'picomatch';

/**
 * Secret filter. Name masks are matched against the file name only, case
 * insensitively, so `src/secrets.ts` is caught but `secrets/README` is not.
 */
export const SECRET_NAME_MASKS = [
  '.env',
  '.env.*',
  '*.key',
  '*.pem',
  '*.p12',
  'id_*',
  '*secret*',
  '*.kdbx',
];

const nameMatchers = SECRET_NAME_MASKS.map((mask) => ({
  mask,
  test: picomatch(mask, { dot: true, nocase: true }),
}));

/**
 * PEM armor lines. Assembled from parts so this file does not trip its own
 * content check when lmpack packs its own repository.
 */
const DASHES = '-'.repeat(5);
const CONTENT_RULES: Array<{ label: string; re: RegExp }> = [
  { label: 'private key', re: new RegExp(`${DASHES}BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY${DASHES}`) },
  { label: 'certificate', re: new RegExp(`${DASHES}BEGIN ${'CERTIFICATE'}${DASHES}`) },
];

/** Returns a reason detail if the file name looks like a secret. */
export function secretByName(filePath: string): string | null {
  const base = filePath.slice(filePath.lastIndexOf('/') + 1);
  const hit = nameMatchers.find((m) => m.test(base));
  return hit ? `name matches ${hit.mask}` : null;
}

/** Returns a reason detail if the content contains PEM key or certificate armor. */
export function secretByContent(text: string): string | null {
  const hit = CONTENT_RULES.find((r) => r.re.test(text));
  return hit ? `contains a PEM ${hit.label}` : null;
}
