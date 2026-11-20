import { describe, it, expect } from 'vitest';
import { plural, slugify } from '../src/lib/text';

describe('plural', () => {
  it('handles one, many and irregular plurals', () => {
    expect(plural(1, 'event')).toBe('1 event');
    expect(plural(0, 'event')).toBe('0 events');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
});

describe('slugify', () => {
  it('strips accents and punctuation, with a fallback for empty results', () => {
    expect(slugify('Déjà Vu: Part 2!')).toBe('deja-vu-part-2');
    expect(slugify('!!!', 'series')).toBe('series');
  });
});
