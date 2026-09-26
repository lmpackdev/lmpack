import { describe, expect, it } from 'vitest';
import { ConfigError, resolveOptions, validateConfig } from '../src/config.js';
import { makeProject } from './helpers.js';

const config = {
  tokenizer: 'cl100k',
  budget: '120k',
  maxFileSize: '64kb',
  priority: ['src', 'tests'],
  categories: { core: ['src/core/**'] },
  profiles: {
    backend: { include: ['src/**'], exclude: ['**/*.snap'], budget: '80k' },
  },
};

describe('config', () => {
  it('uses defaults without lmpack.json', async () => {
    const root = await makeProject();
    const o = await resolveOptions({ path: root });
    expect(o).toMatchObject({ tokenizer: 'o200k', format: 'md', budget: null, maxFileSize: 262144 });
  });

  it('merges CLI > profile > top level', async () => {
    const root = await makeProject({ 'lmpack.json': JSON.stringify(config) });
    const top = await resolveOptions({ path: root });
    expect(top).toMatchObject({ tokenizer: 'cl100k', budget: 120000, maxFileSize: 65536, include: [] });
    expect(top.categories).toEqual([['core', ['src/core/**']]]);

    const prof = await resolveOptions({ path: root, profile: 'backend' });
    expect(prof).toMatchObject({ budget: 80000, include: ['src/**'], exclude: ['**/*.snap'], tokenizer: 'cl100k' });

    const cli = await resolveOptions({ path: root, profile: 'backend', budget: '10k', include: ['lib/**'] });
    expect(cli).toMatchObject({ budget: 10000, include: ['lib/**'], exclude: ['**/*.snap'] });
  });

  it('reports an unknown profile with the available names', async () => {
    const root = await makeProject({ 'lmpack.json': JSON.stringify(config) });
    await expect(resolveOptions({ path: root, profile: 'nope' })).rejects.toThrow(/available: backend/);
  });

  it('rejects invalid config', () => {
    expect(() => validateConfig({ budget: 'lots' })).toThrow(ConfigError);
    expect(() => validateConfig({ include: 'src/**' })).toThrow(/array of strings/);
    expect(() => validateConfig({ tokenzier: 'o200k' })).toThrow(/unknown key "tokenzier"/);
    expect(() => validateConfig({ profiles: { a: { format: 'html' } } })).toThrow(/format/);
  });

  it('rejects broken JSON', async () => {
    const root = await makeProject({ 'lmpack.json': '{ "budget": ' });
    await expect(resolveOptions({ path: root })).rejects.toThrow(/not valid JSON/);
  });
});
