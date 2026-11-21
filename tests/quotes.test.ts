import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity, deleteEntity } from '../src/db/entities';
import { addBook, deleteBook } from '../src/db/books';
import { createSeries } from '../src/db/seed';
import { createQuote, updateQuote, deleteQuote, listQuotes, quotesBy, type QuoteInput } from '../src/db/quotes';
import { search } from '../src/db/search';
import type { SqlDb } from '../src/db/types';

describe('quotes', () => {
  let db: SqlDb;
  let seriesId: number;
  let typeId: (k: string) => number;
  let b1: number, b2: number, hero: number, bard: number, guess: number;
  const q = (over: Partial<QuoteInput>): QuoteInput => ({
    entityId: hero, text: 'A line', bookId: null, chapter: '', speakerId: null, note: '', stance: null, ...over,
  });

  beforeEach(() => {
    ({ db, seriesId, typeId } = setup());
    b1 = addBook(db, seriesId, 'One');
    b2 = addBook(db, seriesId, 'Two');
    hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    bard = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Bard' });
    guess = createEntity(db, { seriesId, typeId: typeId('theory'), name: 'Bard is a spy' });
  });

  it('stores a trimmed quote with its book, chapter, speaker and note', () => {
    createQuote(db, q({ text: '  Never again.  ', bookId: b1, chapter: ' Ch. 3 ', speakerId: bard, note: ' Foreshadowing ' }));
    expect(listQuotes(db, hero)).toMatchObject([{
      text: 'Never again.', chapter: 'Ch. 3', note: 'Foreshadowing', stance: null,
      book: { id: b1, number: 1, title: 'One' }, speaker: { id: bard, name: 'Bard' }, entry: { id: hero, name: 'Hero' },
    }]);
  });

  it('lists in reading order: book, then chapter numerically, undated last', () => {
    createQuote(db, q({ text: 'none' }));
    createQuote(db, q({ text: 'two-10', bookId: b2, chapter: 'Ch. 10' }));
    createQuote(db, q({ text: 'two-2', bookId: b2, chapter: 'Ch. 2' }));
    createQuote(db, q({ text: 'one', bookId: b1, chapter: 'Ch. 40' }));
    expect(listQuotes(db, hero).map((r) => r.text)).toEqual(['one', 'two-2', 'two-10', 'none']);
  });

  it('keeps a stance only on theories', () => {
    createQuote(db, q({ stance: 'for' }));
    createQuote(db, q({ entityId: guess, stance: 'against' }));
    expect(listQuotes(db, hero)[0].stance).toBeNull();
    expect(listQuotes(db, guess)[0].stance).toBe('against');
  });

  it('rejects empty text and references from another series', () => {
    expect(() => createQuote(db, q({ text: '   ' }))).toThrow(/quote/);
    const other = createSeries(db, { name: 'Other' });
    const otherBook = addBook(db, other, 'Elsewhere');
    expect(() => createQuote(db, q({ bookId: otherBook }))).toThrow(/book/);
    const t = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'character'`, [other])[0].id;
    const stranger = createEntity(db, { seriesId: other, typeId: t, name: 'Stranger' });
    expect(() => createQuote(db, q({ speakerId: stranger }))).toThrow(/speaker/);
  });

  it('updates and deletes', () => {
    const id = createQuote(db, q({ text: 'old', bookId: b1 }));
    updateQuote(db, id, { text: 'new', bookId: null, chapter: 'p. 4', speakerId: bard, note: '', stance: null });
    expect(listQuotes(db, hero)).toMatchObject([{ text: 'new', book: null, chapter: 'p. 4', speaker: { id: bard } }]);
    deleteQuote(db, id);
    expect(listQuotes(db, hero)).toEqual([]);
  });

  it("lists a speaker's words filed under other entries", () => {
    createQuote(db, q({ entityId: guess, text: 'I serve no one.', speakerId: bard, stance: 'against' }));
    createQuote(db, q({ entityId: bard, text: 'Filed on himself', speakerId: bard }));
    expect(quotesBy(db, bard).map((r) => [r.text, r.entry.name])).toEqual([['I serve no one.', 'Bard is a spy']]);
  });

  it('goes with its entry, and loses the speaker or book when those are deleted', () => {
    createQuote(db, q({ bookId: b1, speakerId: bard }));
    deleteEntity(db, bard);
    deleteBook(db, b1);
    expect(listQuotes(db, hero)).toMatchObject([{ speaker: null, book: null }]);
    deleteEntity(db, hero);
    expect(db.query('SELECT * FROM quote')).toEqual([]);
  });

  it('is found by search, under the entry it is filed on', () => {
    createQuote(db, q({ entityId: guess, text: 'The coin spun in the air.' }));
    expect(search(db, { seriesId, q: 'coin spun' })).toMatchObject([
      { id: guess, field: 'quote', snippet: { text: 'The coin spun in the air.' } },
    ]);
  });
});
