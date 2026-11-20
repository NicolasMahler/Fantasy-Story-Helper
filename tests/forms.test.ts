import { describe, it, expect } from 'vitest';
import { numOrNull, attempt, listKey } from '../src/lib/forms';

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

describe('listKey', () => {
  it('moves with wrap-around, picks, closes, and ignores other keys', () => {
    expect(listKey('ArrowDown', 0, 3)).toBe(1);
    expect(listKey('ArrowDown', 2, 3)).toBe(0);
    expect(listKey('ArrowUp', 0, 3)).toBe(2);
    expect(listKey('Enter', 1, 3)).toBe('pick');
    expect(listKey('Escape', 1, 3)).toBe('close');
    expect(listKey('a', 1, 3)).toBeNull();
  });
  it('picks on Tab only when asked, and handles only Escape when empty', () => {
    expect(listKey('Tab', 0, 3)).toBeNull();
    expect(listKey('Tab', 0, 3, { pickOnTab: true })).toBe('pick');
    expect(listKey('ArrowDown', 0, 0)).toBeNull();
    expect(listKey('Enter', 0, 0)).toBeNull();
    expect(listKey('Escape', 0, 0)).toBe('close');
  });
});
