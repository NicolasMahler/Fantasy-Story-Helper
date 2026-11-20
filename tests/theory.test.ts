import { describe, it, expect } from 'vitest';
import { statusLine } from '../src/lib/theory';

const book = { id: 7, number: 2, title: 'Deadhouse Gates' };

describe('statusLine', () => {
  it('names open theories and questions', () => {
    expect(statusLine({ kind: 'theory', status: 'open', resolvedBook: null })).toBe('Open theory');
    expect(statusLine({ kind: 'question', status: 'open', resolvedBook: null })).toBe('Open question');
  });

  it('says where it was settled, when known', () => {
    expect(statusLine({ kind: 'theory', status: 'wrong', resolvedBook: book })).toBe('Wrong in Book 2');
    expect(statusLine({ kind: 'question', status: 'answered', resolvedBook: book })).toBe('Answered in Book 2');
    expect(statusLine({ kind: 'theory', status: 'confirmed', resolvedBook: null })).toBe('Confirmed');
  });
});
