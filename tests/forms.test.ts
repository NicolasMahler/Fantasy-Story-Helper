import { describe, it, expect } from 'vitest';
import { numOrNull, attempt, listKey, mergeAttributes } from '../src/lib/forms';

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

describe('mergeAttributes', () => {
  const fields = [
    { key: 'rank', label: 'Rank', kind: 'text' as const },
    { key: 'age', label: 'Age', kind: 'number' as const },
  ];

  it('clears a field that was blanked', () => {
    expect(mergeAttributes(fields, { rank: '', age: 40 }, { rank: 'Captain', age: 39 })).toEqual({ age: 40 });
    expect(mergeAttributes(fields, { rank: 'Captain', age: null }, { rank: 'Captain', age: 39 })).toEqual({ rank: 'Captain' });
  });

  it('stores numbers as numbers and text as text', () => {
    expect(mergeAttributes(fields, { rank: 7, age: '12' }, {})).toEqual({ rank: '7', age: 12 });
  });

  it('keeps values of fields the type no longer has, unless the type changed', () => {
    expect(mergeAttributes(fields, { rank: 'Sergeant' }, { rank: 'Captain', oath: 'Kept' })).toEqual({ rank: 'Sergeant', oath: 'Kept' });
    expect(mergeAttributes(fields, { rank: 'Sergeant' }, null)).toEqual({ rank: 'Sergeant' });
  });
});
