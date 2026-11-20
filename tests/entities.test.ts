import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import {
  createEntity, updateEntity, deleteEntity, getEntity, listEntities, searchEntities, backlinks,
} from '../src/db/entities';
import { createSeries } from '../src/db/seed';
import { addBook } from '../src/db/books';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
let typeId: (k: string) => number;
beforeEach(() => ({ db, seriesId, typeId } = setup()));

const count = (sql: string, p: unknown[] = []) => db.query<{ n: number }>(sql, p)[0].n;

describe('createEntity / getEntity', () => {
  it('creates an entry with attributes and first book', () => {
    const book = addBook(db, seriesId, 'One');
    const id = createEntity(db, {
      seriesId, typeId: typeId('character'), name: ' Aria ', description: 'A bard.',
      firstBookId: book, attributes: { allegiance: 'North' },
    });
    expect(getEntity(db, id)).toMatchObject({
      id, name: 'Aria', description: 'A bard.', first_book_id: book,
      attributes: { allegiance: 'North' }, type: { key: 'character' }, firstBook: { number: 1, title: 'One' },
    });
  });

  it('rejects a blank name and a type from another series', () => {
    expect(() => createEntity(db, { seriesId, typeId: typeId('item'), name: '' })).toThrow(/name/i);
    const other = createSeries(db, { name: 'Other' });
    expect(() => createEntity(db, { seriesId: other, typeId: typeId('item'), name: 'X' })).toThrow(/type/i);
  });

  it('gives event entries their event row (rule 2)', () => {
    const id = createEntity(db, { seriesId, typeId: typeId('event'), name: 'The Fall' });
    expect(db.query('SELECT mode, date_precision FROM event WHERE entity_id = ?', [id])).toEqual([
      { mode: 'present', date_precision: null },
    ]);
  });

  it('returns null for a missing entity', () => {
    expect(getEntity(db, 999)).toBeNull();
  });
});

describe('mentions and backlinks (rule 3)', () => {
  it('rebuilds mention rows from the description and resolves current names', () => {
    const a = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Aria' });
    const city = createEntity(db, { seriesId, typeId: typeId('location'), name: 'Vel' });
    const id = createEntity(db, {
      seriesId, typeId: typeId('lore'), name: 'Song',
      description: `About @[Aria](${a}) in @[Old name](${city}) and @[Ghost](9999).`,
    });
    expect(backlinks(db, a).map((b) => b.name)).toEqual(['Song']);
    expect(getEntity(db, id)!.links).toEqual({
      [a]: { id: a, name: 'Aria', icon: expect.any(String), color: expect.any(String) },
      [city]: { id: city, name: 'Vel', icon: expect.any(String), color: expect.any(String) },
    });

    updateEntity(db, id, { description: `Only @[Vel](${city}) now.` });
    expect(backlinks(db, a)).toEqual([]);
    expect(backlinks(db, city).map((b) => b.name)).toEqual(['Song']);
  });

  it('ignores self-mentions and mentions of entries in other series', () => {
    const other = createSeries(db, { name: 'Other' });
    const otherType = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'item'`, [other])[0].id;
    const foreign = createEntity(db, { seriesId: other, typeId: otherType, name: 'Foreign' });
    const id = createEntity(db, { seriesId, typeId: typeId('item'), name: 'Me' });
    updateEntity(db, id, { description: `@[Me](${id}) @[F](${foreign})` });
    expect(count('SELECT COUNT(*) AS n FROM mention')).toBe(0);
  });

  it('drops backlinks when the source is deleted', () => {
    const a = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Aria' });
    const s = createEntity(db, { seriesId, typeId: typeId('lore'), name: 'Song', description: `@[Aria](${a})` });
    deleteEntity(db, s);
    expect(backlinks(db, a)).toEqual([]);
  });
});

describe('updateEntity', () => {
  it('patches fields and bumps updated_at', () => {
    const id = createEntity(db, { seriesId, typeId: typeId('item'), name: 'Sword' });
    db.exec(`UPDATE entity SET updated_at = '2000-01-01 00:00:00' WHERE id = ?`, [id]);
    updateEntity(db, id, { name: 'Blade', attributes: { forged: 'Age 2' } });
    const e = getEntity(db, id)!;
    expect(e).toMatchObject({ name: 'Blade', attributes: { forged: 'Age 2' } });
    expect(e.updated_at > '2000-01-01').toBe(true);
  });

  it('adds or removes the event row when the type changes', () => {
    const id = createEntity(db, { seriesId, typeId: typeId('lore'), name: 'Myth' });
    updateEntity(db, id, { typeId: typeId('event') });
    expect(count('SELECT COUNT(*) AS n FROM event WHERE entity_id = ?', [id])).toBe(1);
    updateEntity(db, id, { typeId: typeId('lore') });
    expect(count('SELECT COUNT(*) AS n FROM event WHERE entity_id = ?', [id])).toBe(0);
  });

  it('only recomputes timeline positions when an entry becomes or stops being an event', () => {
    const ev = createEntity(db, { seriesId, typeId: typeId('event'), name: 'Fall' });
    const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    // A stale key that a recompute would reset to null (the event is undated).
    db.exec('UPDATE event SET sort_key = 42 WHERE entity_id = ?', [ev]);
    const sortKey = () => db.query<{ k: number | null }>('SELECT sort_key AS k FROM event WHERE entity_id = ?', [ev])[0].k;
    updateEntity(db, hero, { name: 'Heroine', description: 'Brave.' });
    updateEntity(db, ev, { name: 'The Fall' });
    updateEntity(db, hero, { typeId: typeId('lore') });
    deleteEntity(db, hero);
    expect(sortKey()).toBe(42);
    const myth = createEntity(db, { seriesId, typeId: typeId('lore'), name: 'Myth' });
    updateEntity(db, myth, { typeId: typeId('event') });
    expect(sortKey()).toBeNull();
  });
});

describe('listEntities / searchEntities', () => {
  beforeEach(() => {
    createEntity(db, { seriesId, typeId: typeId('character'), name: 'Aria' });
    createEntity(db, { seriesId, typeId: typeId('character'), name: 'Barian' });
    createEntity(db, { seriesId, typeId: typeId('item'), name: 'Arrow of Ash' });
  });

  it('lists by name, filtered by type and text', () => {
    expect(listEntities(db, seriesId).map((e) => e.name)).toEqual(['Aria', 'Arrow of Ash', 'Barian']);
    expect(listEntities(db, seriesId, { typeId: typeId('character') }).map((e) => e.name)).toEqual(['Aria', 'Barian']);
    expect(listEntities(db, seriesId, { search: 'ari' }).map((e) => e.name)).toEqual(['Aria', 'Barian']);
  });

  it('ranks prefix matches first and narrows by type key', () => {
    expect(searchEntities(db, seriesId, null, 'ar').map((e) => e.name)).toEqual(['Aria', 'Arrow of Ash', 'Barian']);
    expect(searchEntities(db, seriesId, 'item', 'ar').map((e) => e.name)).toEqual(['Arrow of Ash']);
    expect(searchEntities(db, seriesId, 'nonsense', '')).toEqual([]);
    expect(searchEntities(db, seriesId, null, '').length).toBe(3);
  });

  it('treats LIKE wildcards in the search literally', () => {
    expect(searchEntities(db, seriesId, null, '%')).toEqual([]);
  });
});
