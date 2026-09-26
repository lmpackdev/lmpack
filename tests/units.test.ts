import { describe, expect, it } from 'vitest';
import { parseBytes, parseTokens } from '../src/units.js';

describe('parseTokens', () => {
  it.each([
    ['120000', 120000],
    ['120k', 120000],
    ['120K', 120000],
    ['1.5m', 1500000],
    [80000, 80000],
  ] as const)('%s → %d', (input, expected) => expect(parseTokens(input)).toBe(expected));

  it.each(['', 'abc', '10x', '-5', '0'])('rejects %j', (input) => {
    expect(() => parseTokens(input)).toThrow();
  });
});

describe('parseBytes', () => {
  it.each([
    ['1000', 1000],
    ['256kb', 262144],
    ['256k', 262144],
    ['1mb', 1048576],
    ['2MB', 2097152],
  ] as const)('%s → %d', (input, expected) => expect(parseBytes(input)).toBe(expected));

  it('rejects garbage', () => expect(() => parseBytes('big')).toThrow());
});
