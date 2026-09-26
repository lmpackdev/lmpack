/**
 * Dependency lock files. Machine-generated and large; the dependency list a
 * model needs is in the manifest next to them. Skipped unless `--include`
 * names them.
 */
export const LOCKFILES = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'deno.lock',
  'Cargo.lock',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'pdm.lock',
  'composer.lock',
  'Gemfile.lock',
  'go.sum',
  'mix.lock',
  'pubspec.lock',
  'Podfile.lock',
  'packages.lock.json',
  'flake.lock',
];

const names = new Set(LOCKFILES);

export function isLockfile(filePath: string): boolean {
  return names.has(filePath.slice(filePath.lastIndexOf('/') + 1));
}
