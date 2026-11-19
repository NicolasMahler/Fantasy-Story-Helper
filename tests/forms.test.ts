import { describe, it, expect } from 'vitest';
import { numOrNull, attempt } from '../src/lib/forms';

describe('numOrNull', () => {
  it('handles what Svelte number inputs bind (number or null) and string drafts', () => {
    expect(numOrNull(5)).toBe(5);
    expect(numOrNull(0)).toBe(0);
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull(undefined)).toBeNull();
    expect(numOrNull('')).toBeNull();
    expect(numOrNull('  ')).toBeNull();
    expect(numOrNull('12')).toBe(12);
    expect(numOrNull('abc')).toBeNaN();
  });
});

describe('attempt', () => {
  it('reports errors instead of rejecting', async () => {
    let msg: string | null = null;
    expect(await attempt(async () => { throw new Error('nope'); }, (m) => (msg = m))).toBe(false);
    expect(msg).toBe('nope');
    expect(await attempt(async () => {}, () => { throw new Error('should not be called'); })).toBe(true);
  });
});
