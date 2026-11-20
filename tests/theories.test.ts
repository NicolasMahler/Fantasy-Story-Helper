import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity, updateEntity, deleteEntity, listEntities } from '../src/db/entities';
import { addBook } from '../src/db/books';
import { createSeries } from '../src/db/seed';
import { saveTheory, getTheoryDetail, statusForKind, type TheoryInput } from '../src/db/theories';
import type { SqlDb } from '../src/db/types';

const open: TheoryInput = { kind: 'theory', status: 'open', resolvedBookId: null, resolution: '' };

describe('theories', () => {
  let db: SqlDb;
  let seriesId: number;
  let typeId: (k: string) => number;
  let book: number;
  beforeEach(() => {
    ({ db, seriesId, typeId } = setup());
    book = addBook(db, seriesId, 'Gardens');
  });
  const make = (name: string) => createEntity(db, { seriesId, typeId: typeId('theory'), name });

  it('starts as an open theory', () => {
    expect(getTheoryDetail(db, make('The Rope is Dancer'))).toMatchObject({
      kind: 'theory', status: 'open', resolvedBook: null, resolution: '',
    });
  });

  it('records where and how it was settled', () => {
    const id = make('Sorry is possessed');
    saveTheory(db, id, { kind: 'theory', status: 'confirmed', resolvedBookId: book, resolution: '  By Cotillion.  ' });
    expect(getTheoryDetail(db, id)).toMatchObject({
      status: 'confirmed', resolvedBook: { id: book, number: 1, title: 'Gardens' }, resolution: 'By Cotillion.',
    });
  });

  it('clears the book and note when reopened', () => {
    const id = make('Kruppe is harmless');
    saveTheory(db, id, { kind: 'theory', status: 'wrong', resolvedBookId: book, resolution: 'He is not.' });
    saveTheory(db, id, { ...open, resolvedBookId: book, resolution: 'ignored' });
    expect(getTheoryDetail(db, id)).toMatchObject({ status: 'open', resolvedBook: null, resolution: '' });
  });

  it('only allows statuses that fit the kind', () => {
    const id = make('Who is Sorry?');
    expect(() => saveTheory(db, id, { ...open, kind: 'question', status: 'wrong' })).toThrow(/open or answered/);
    expect(() => saveTheory(db, id, { ...open, status: 'answered' })).toThrow(/open, confirmed or wrong/);
    saveTheory(db, id, { ...open, kind: 'question', status: 'answered', resolvedBookId: book });
    expect(getTheoryDetail(db, id)).toMatchObject({ kind: 'question', status: 'answered' });
  });

  it('refuses a book from another series and entries that are not theories', () => {
    const id = make('Guess');
    const elsewhere = addBook(db, createSeries(db, { name: 'Other' }), 'Elsewhere');
    expect(() => saveTheory(db, id, { ...open, status: 'confirmed', resolvedBookId: elsewhere })).toThrow(/does not belong/);
    const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    expect(() => saveTheory(db, hero, open)).toThrow(/not a theory/);
  });

  it('follows the entry through retyping and deletion', () => {
    const id = createEntity(db, { seriesId, typeId: typeId('lore'), name: 'Old note' });
    expect(getTheoryDetail(db, id)).toBeNull();
    updateEntity(db, id, { typeId: typeId('theory') });
    expect(getTheoryDetail(db, id)).toMatchObject({ status: 'open' });
    updateEntity(db, id, { typeId: typeId('lore') });
    expect(getTheoryDetail(db, id)).toBeNull();
    const t = make('Doomed');
    deleteEntity(db, t);
    expect(db.query('SELECT * FROM theory WHERE entity_id = ?', [t])).toEqual([]);
  });

  it('lists entries with their status and filters by it', () => {
    const a = make('A');
    const b = make('B');
    saveTheory(db, b, { ...open, status: 'confirmed' });
    createEntity(db, { seriesId, typeId: typeId('character'), name: 'C' });
    expect(listEntities(db, seriesId).map((e) => [e.name, e.theory_kind, e.theory_status])).toEqual([
      ['A', 'theory', 'open'], ['B', 'theory', 'confirmed'], ['C', null, null],
    ]);
    expect(listEntities(db, seriesId, { theoryStatus: 'open' }).map((e) => e.id)).toEqual([a]);
    expect(listEntities(db, seriesId, { theoryStatus: 'confirmed', search: 'B' }).map((e) => e.id)).toEqual([b]);
  });
});

describe('statusForKind', () => {
  it('keeps statuses that fit and maps the rest', () => {
    expect(statusForKind('question', 'confirmed')).toBe('answered');
    expect(statusForKind('question', 'wrong')).toBe('open');
    expect(statusForKind('theory', 'answered')).toBe('confirmed');
    expect(statusForKind('theory', 'wrong')).toBe('wrong');
  });
});
