import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity } from '../src/db/entities';
import { createSeries } from '../src/db/seed';
import { addBook } from '../src/db/books';
import { createAge } from '../src/db/calendar';
import { createLink } from '../src/db/links';
import { createType } from '../src/db/entityTypes';
import { search, makeSnippet } from '../src/db/search';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
let typeId: (k: string) => number;
beforeEach(() => {
  ({ db, seriesId, typeId } = setup());
  const ship = createType(db, seriesId, { name: 'Ship', icon: '⛵', color: '#123456', fields: [{ key: 'captain', label: 'Captain', kind: 'text' }] });
  const kalam = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Kalam', description: 'An assassin.' });
  const ben = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Quick Ben', description: `Mage, friend of @[Kalam](${kalam}).` });
  createEntity(db, { seriesId, typeId: typeId('location'), name: 'Pale' });
  createEntity(db, { seriesId, typeId: ship, name: 'Silanda', attributes: { captain: 'Kalam the Bold' } });
  createLink(db, { fromId: ben, toId: kalam, kind: 'partners', note: 'old assassin friends' });
  addBook(db, seriesId, 'Gardens of the Moon');
  createAge(db, seriesId, { name: 'Burn\'s Sleep', startYear: 0, endYear: null, direction: 'forward' });
});

describe('makeSnippet', () => {
  it('shows @ links as plain names and marks the match', () => {
    expect(makeSnippet('Mage, friend of @[Kalam](3).', 'kal')).toEqual({ text: 'Mage, friend of Kalam.', start: 16, length: 3 });
  });
  it('trims long text around the match', () => {
    const s = makeSnippet(`${'x '.repeat(80)}needle ${'y '.repeat(80)}`, 'needle');
    expect(s.text.startsWith('…')).toBe(true);
    expect(s.text.endsWith('…')).toBe(true);
    expect(s.text.slice(s.start, s.start + s.length)).toBe('needle');
  });
});

describe('search', () => {
  it('ranks name prefix, then name contains, then other fields', () => {
    const r = search(db, { seriesId, q: 'kal' });
    expect(r.map((x) => `${x.kind}:${x.name}:${x.field}`)).toEqual([
      'entity:Kalam:name',
      'entity:Quick Ben:description',
      'entity:Silanda:Captain',
    ]);
    expect(r[1].snippet).toMatchObject({ text: 'Mage, friend of Kalam.' });
  });

  it('finds relationship notes, books and ages', () => {
    expect(search(db, { seriesId, q: 'assassin friends' }).map((x) => `${x.kind}:${x.name}:${x.field}`)).toEqual([
      'entity:Quick Ben:relationship',
    ]);
    expect(search(db, { seriesId, q: 'gardens' })).toMatchObject([{ kind: 'book', name: 'Book 1: Gardens of the Moon' }]);
    expect(search(db, { seriesId, q: 'burn' })).toMatchObject([{ kind: 'age', name: 'Burn\'s Sleep' }]);
  });

  it('is scoped to a series, or searches everything (including series names) when none is given', () => {
    const other = createSeries(db, { name: 'Pale Kings' });
    const t = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'item'`, [other])[0].id;
    createEntity(db, { seriesId: other, typeId: t, name: 'Pale Sword' });
    expect(search(db, { seriesId, q: 'pale' }).map((x) => x.name)).toEqual(['Pale']);
    expect(search(db, { seriesId: null, q: 'pale' }).map((x) => `${x.kind}:${x.name}`)).toEqual([
      'series:Pale Kings', 'entity:Pale', 'entity:Pale Sword',
    ]);
  });

  it('finds several entries that match only through relationships, using each one\'s first matching link', () => {
    const c = typeId('character');
    const a = createEntity(db, { seriesId, typeId: c, name: 'Anomander' });
    const b = createEntity(db, { seriesId, typeId: c, name: 'Brood' });
    const d = createEntity(db, { seriesId, typeId: c, name: 'Draconus' });
    createLink(db, { fromId: a, toId: d, kind: 'sworn foe' });
    createLink(db, { fromId: a, toId: b, kind: 'sworn ally' });
    createLink(db, { fromId: b, toId: a, kind: 'sworn ally' });
    const r = search(db, { seriesId, q: 'sworn' });
    expect(r.map((x) => `${x.name}:${x.field}:${x.snippet?.text}`)).toEqual([
      'Anomander:relationship:sworn foe Draconus',
      'Brood:relationship:sworn ally Anomander',
    ]);
  });

  it('does not use relationships from other series', () => {
    const other = createSeries(db, { name: 'Other' });
    const t = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'item'`, [other])[0].id;
    const x = createEntity(db, { seriesId: other, typeId: t, name: 'X' });
    const y = createEntity(db, { seriesId: other, typeId: t, name: 'Y' });
    createLink(db, { fromId: x, toId: y, kind: 'partners' });
    expect(search(db, { seriesId, q: 'partners' }).map((r) => r.name)).toEqual(['Quick Ben']);
  });

  it('ignores blank queries and treats wildcards literally', () => {
    expect(search(db, { seriesId, q: '  ' })).toEqual([]);
    expect(search(db, { seriesId, q: '%' })).toEqual([]);
  });
});
