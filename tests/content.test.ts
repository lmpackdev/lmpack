import { describe, expect, it } from 'vitest';
import { decodeContent } from '../src/content.js';
import { packProject } from '../src/pack.js';
import { makeProject } from './helpers.js';

const bytes = (...b: number[]) => Uint8Array.from(b);
const utf8 = (s: string) => new TextEncoder().encode(s);

describe('decodeContent', () => {
  it('accepts plain UTF-8 and normalizes line endings', () => {
    expect(decodeContent(utf8('a\r\nb\rc\n'), 1000)).toEqual({ ok: true, text: 'a\nb\nc\n', bomStripped: false });
  });

  it('strips a UTF-8 BOM and says so', () => {
    const r = decodeContent(bytes(0xef, 0xbb, 0xbf, 0x78, 0x0a), 1000);
    expect(r).toEqual({ ok: true, text: 'x\n', bomStripped: true });
  });

  it('skips UTF-16 files by their byte-order mark', () => {
    const r = decodeContent(bytes(0xff, 0xfe, 0x68, 0x00, 0x69, 0x00), 1000);
    expect(r).toMatchObject({ ok: false, reason: 'non-utf8', detail: 'UTF-16 LE byte-order mark' });
  });

  it('treats NUL bytes as binary', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
    expect(decodeContent(png, 1000)).toMatchObject({ ok: false, reason: 'binary' });
  });

  it('treats invalid UTF-8 with many control bytes as binary', () => {
    const blob = new Uint8Array(512).map((_, i) => (i % 3 === 0 ? 0xff : i % 7));
    expect(decodeContent(blob, 1000)).toMatchObject({ ok: false, reason: 'binary' });
  });

  it('reports legacy-encoded text as non-utf8, not binary', () => {
    const latin1 = bytes(...utf8('caf'), 0xe9, ...utf8(' au lait\n'));
    expect(decodeContent(latin1, 1000)).toMatchObject({ ok: false, reason: 'non-utf8' });
  });

  it('skips empty and whitespace-only files', () => {
    expect(decodeContent(new Uint8Array(), 1000)).toMatchObject({ ok: false, reason: 'empty' });
    expect(decodeContent(utf8('  \n\n'), 1000)).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('skips minified files by line length', () => {
    const r = decodeContent(utf8('short\n' + 'x'.repeat(1001) + '\n'), 1000);
    expect(r).toMatchObject({ ok: false, reason: 'long-line', detail: 'line of 1001 chars > 1000' });
    expect(decodeContent(utf8('x'.repeat(1000)), 1000)).toMatchObject({ ok: true });
  });
});

describe('content checks in a pack', () => {
  it('skips binary, oversized and odd files with reasons in the report', async () => {
    const root = await makeProject({
      'ok.ts': 'export {};\n',
      'logo.png': bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x00),
      'big.txt': 'y'.repeat(2048),
      'bom.ts': bytes(0xef, 0xbb, 0xbf, ...utf8('const a = 1;\n')),
      'empty.ts': '',
    });
    const r = await packProject({ path: root, maxFileSize: '1kb' });
    expect(r.files.map((f) => f.path)).toEqual(['bom.ts', 'ok.ts']);
    expect(r.files[0]!.content).toBe('const a = 1;\n');
    expect(r.notes).toEqual([{ path: 'bom.ts', note: 'UTF-8 byte-order mark stripped' }]);
    const reasons = Object.fromEntries(r.skipped.map((s) => [s.path, s.reason]));
    expect(reasons).toEqual({ 'logo.png': 'binary', 'big.txt': 'size', 'empty.ts': 'empty' });
  });
});
