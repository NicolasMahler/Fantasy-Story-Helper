import { describe, it, expect } from 'vitest';
import { formatMention, parseMentionIds, tokenize, parseAtQuery } from '../src/db/mentions';

describe('mention tokens', () => {
  it('formats a token and strips characters that would break it', () => {
    expect(formatMention('Aragorn', 12)).toBe('@[Aragorn](12)');
    expect(formatMention('The [Lost]\nKing', 3)).toBe('@[The Lost King](3)');
  });

  it('parses unique target ids in order of first appearance', () => {
    expect(parseMentionIds('Met @[A](2) and @[B](5), then @[A again](2).')).toEqual([2, 5]);
    expect(parseMentionIds('no links, just an email a@b.c and @[broken](x)')).toEqual([]);
  });

  it('tokenizes text into text and mention segments', () => {
    expect(tokenize('Hi @[A](2)!')).toEqual([
      { kind: 'text', text: 'Hi ' },
      { kind: 'mention', id: 2, label: 'A' },
      { kind: 'text', text: '!' },
    ]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('parseAtQuery (text before the caret)', () => {
  it('detects a bare @ query', () => {
    expect(parseAtQuery('Then @Ara')).toEqual({ start: 5, typeKey: null, term: 'Ara' });
    expect(parseAtQuery('@')).toEqual({ start: 0, typeKey: null, term: '' });
  });

  it('detects a type prefix', () => {
    expect(parseAtQuery('found (@item:sw')).toEqual({ start: 7, typeKey: 'item', term: 'sw' });
    expect(parseAtQuery('@item:')).toEqual({ start: 0, typeKey: 'item', term: '' });
  });

  it('allows spaces inside the term once started', () => {
    expect(parseAtQuery('see @Minas Ti')).toEqual({ start: 4, typeKey: null, term: 'Minas Ti' });
  });

  it('ignores emails, finished tokens and stale queries', () => {
    expect(parseAtQuery('mail me at a@b')).toBeNull();
    expect(parseAtQuery('@[Aragorn](12) ')).toBeNull();
    expect(parseAtQuery('plain text')).toBeNull();
    expect(parseAtQuery('@abc\nnext line')).toBeNull();
  });
});
