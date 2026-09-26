import { describe, expect, it } from 'vitest';
import { secretByContent, secretByName } from '../src/guard.js';
import { packProject } from '../src/pack.js';
import { renderReport } from '../src/report.js';
import { makeProject, pem } from './helpers.js';

describe('secretByName', () => {
  it.each([
    ['.env', '.env'],
    ['config/.env.production', '.env.*'],
    ['certs/server.pem', '*.pem'],
    ['tls.KEY', '*.key'],
    ['store.p12', '*.p12'],
    ['home/id_ed25519', 'id_*'],
    ['src/client_secret.json', '*secret*'],
    ['vault.kdbx', '*.kdbx'],
  ])('%s matches %s', (p, mask) => expect(secretByName(p)).toBe(`name matches ${mask}`));

  it.each(['src/env.ts', 'secrets/README.md', 'docs/security-filter.md', 'keys.ts'])('%s is not a secret', (p) => {
    expect(secretByName(p)).toBeNull();
  });
});

describe('secretByContent', () => {
  it('finds PEM private keys of any flavor and certificates', () => {
    expect(secretByContent(`x\n${pem('PRIVATE KEY')}\nMIIE\n`)).toBe('contains a PEM private key');
    expect(secretByContent(`${pem('RSA PRIVATE KEY')}\n`)).toBe('contains a PEM private key');
    expect(secretByContent(`${pem('OPENSSH PRIVATE KEY')}\n`)).toBe('contains a PEM private key');
    expect(secretByContent(`${pem('CERTIFICATE')}\n`)).toBe('contains a PEM certificate');
  });

  it('ignores prose that merely mentions keys', () => {
    expect(secretByContent('Files containing BEGIN PRIVATE KEY are dropped.\n')).toBeNull();
    expect(secretByContent(`${pem('PUBLIC KEY')}\n`)).toBeNull();
  });
});

describe('secret filter in a pack', () => {
  const tree = {
    'src/app.ts': 'export const port = 3000;\n',
    '.env': 'DATABASE_PASSWORD=hunter2\n',
    'certs/server.pem': `${pem('CERTIFICATE')}\nMIIB\n`,
    'config/deploy.txt': `${pem('RSA PRIVATE KEY')}\nsupersecretmaterial\n`,
  };

  it('drops secrets by default and reports each one without its content', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root });
    expect(r.files.map((f) => f.path)).toEqual(['src/app.ts']);
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        { path: '.env', reason: 'secret', detail: 'name matches .env' },
        { path: 'certs/server.pem', reason: 'secret', detail: 'name matches *.pem' },
        { path: 'config/deploy.txt', reason: 'secret', detail: 'contains a PEM private key' },
      ]),
    );
    const report = renderReport(r);
    expect(report).toMatch(/secret\s+\.env/);
    expect(report).toMatch(/secret\s+certs\/server\.pem/);
    for (const leaked of ['hunter2', 'supersecretmaterial', 'MIIB']) {
      expect(r.output).not.toContain(leaked);
      expect(report).not.toContain(leaked);
    }
  });

  it('keeps secrets with --allow-secrets', async () => {
    const root = await makeProject(tree);
    const r = await packProject({ path: root, allowSecrets: true });
    expect(r.files.map((f) => f.path)).toEqual(['.env', 'certs/server.pem', 'config/deploy.txt', 'src/app.ts']);
  });
});
