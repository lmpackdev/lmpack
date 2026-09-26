import type { SkipReason } from './types.js';

/** Bytes inspected for NUL when deciding whether a file is binary. */
const SNIFF_BYTES = 8 * 1024;

export type ContentResult =
  | { ok: true; text: string; bomStripped: boolean }
  | { ok: false; reason: SkipReason; detail?: string };

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Decide whether a file's bytes can go into the pack and return its text.
 * Line endings are normalized to LF.
 */
export function decodeContent(buf: Uint8Array, maxLineLength: number): ContentResult {
  if (buf.length === 0) return { ok: false, reason: 'empty' };

  const utf16 = detectUtf16or32(buf);
  if (utf16) return { ok: false, reason: 'non-utf8', detail: `${utf16} byte-order mark` };

  const sniff = buf.subarray(0, SNIFF_BYTES);
  if (sniff.includes(0)) return { ok: false, reason: 'binary' };

  let text: string;
  try {
    text = decoder.decode(buf);
  } catch {
    // Legacy-encoded text (cp1251, latin-1) has few control bytes; binary formats have many.
    return validUtf8Prefix(sniff) || controlRatio(sniff) < 0.01
      ? { ok: false, reason: 'non-utf8' }
      : { ok: false, reason: 'binary' };
  }

  let bomStripped = false;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    bomStripped = true;
  }
  text = text.replace(/\r\n?/g, '\n');
  if (text.trim() === '') return { ok: false, reason: 'empty', detail: 'whitespace only' };

  const longest = longestLine(text);
  if (longest > maxLineLength) {
    return { ok: false, reason: 'long-line', detail: `line of ${longest} chars > ${maxLineLength}` };
  }
  return { ok: true, text, bomStripped };
}

function detectUtf16or32(b: Uint8Array): string | null {
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0xfe && b[3] === 0xff) return 'UTF-32 BE';
  if (b[0] === 0xff && b[1] === 0xfe && b[2] === 0x00 && b[3] === 0x00) return 'UTF-32 LE';
  if (b[0] === 0xfe && b[1] === 0xff) return 'UTF-16 BE';
  if (b[0] === 0xff && b[1] === 0xfe) return 'UTF-16 LE';
  return null;
}

/** Valid UTF-8 in the sniffed prefix, allowing a multi-byte char cut at the end. */
function validUtf8Prefix(sniff: Uint8Array): boolean {
  for (let cut = 0; cut < 4 && cut < sniff.length; cut++) {
    try {
      decoder.decode(sniff.subarray(0, sniff.length - cut));
      return true;
    } catch {
      // try a shorter prefix
    }
  }
  return false;
}

function controlRatio(b: Uint8Array): number {
  let n = 0;
  for (const byte of b) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) n++;
  }
  return b.length ? n / b.length : 0;
}

function longestLine(text: string): number {
  let max = 0;
  let start = 0;
  for (;;) {
    const nl = text.indexOf('\n', start);
    const end = nl === -1 ? text.length : nl;
    if (end - start > max) max = end - start;
    if (nl === -1) return max;
    start = nl + 1;
  }
}
