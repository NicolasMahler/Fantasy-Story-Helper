import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { addBook, listBooks, updateBook, deleteBook, moveBook } from '../src/db/books';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
beforeEach(() => ({ db, seriesId } = setup()));

const titles = () => listBooks(db, seriesId).map((b) => `${b.number}:${b.title}`);

describe('books', () => {
  it('appends with the next number', () => {
    addBook(db, seriesId, 'One');
    addBook(db, seriesId, 'Two');
    expect(titles()).toEqual(['1:One', '2:Two']);
  });

  it('rejects a blank title', () => {
    expect(() => addBook(db, seriesId, '  ')).toThrow(/title/i);
  });

  it('renames', () => {
    const id = addBook(db, seriesId, 'One');
    updateBook(db, id, 'The First');
    expect(titles()).toEqual(['1:The First']);
  });

  it('moves a book by swapping with its neighbour, and no-ops at the ends', () => {
    addBook(db, seriesId, 'A');
    const b = addBook(db, seriesId, 'B');
    addBook(db, seriesId, 'C');
    moveBook(db, b, -1);
    expect(titles()).toEqual(['1:B', '2:A', '3:C']);
    moveBook(db, b, -1);
    expect(titles()).toEqual(['1:B', '2:A', '3:C']);
  });

  it('deletes and closes the numbering gap', () => {
    addBook(db, seriesId, 'A');
    const b = addBook(db, seriesId, 'B');
    addBook(db, seriesId, 'C');
    deleteBook(db, b);
    expect(titles()).toEqual(['1:A', '2:C']);
  });

  it('reports how many entries and events reference each book', () => {
    const id = addBook(db, seriesId, 'A');
    db.exec(`INSERT INTO entity (series_id, type_id, name, first_book_id)
             SELECT ?, id, 'X', ? FROM entity_type WHERE key = 'character' AND series_id = ?`, [seriesId, id, seriesId]);
    expect(listBooks(db, seriesId)[0].entities).toBe(1);
  });
});
