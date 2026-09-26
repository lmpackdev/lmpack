import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';

const created: string[] = [];

afterEach(async () => {
  while (created.length) await rm(created.pop()!, { recursive: true, force: true });
});

/** Create a temporary project from a map of POSIX paths to contents. */
export async function makeProject(files: Record<string, string | Uint8Array> = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'lmpack-test-'));
  created.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
  return root;
}

/** PEM armor built from parts so this file itself is not flagged as a secret. */
export const pem = (label: string) => `${'-'.repeat(5)}BEGIN ${label}${'-'.repeat(5)}`;
