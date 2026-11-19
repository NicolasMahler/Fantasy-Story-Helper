import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity, deleteEntity, updateEntity } from '../src/db/entities';
import { addBook } from '../src/db/books';
import { createAge } from '../src/db/calendar';
import { createSeries, deleteSeries } from '../src/db/seed';
import {
  getEventDetail, saveEvent, addParticipant, removeParticipant, updateParticipantRole, eventsForEntity,
  type EventInput,
} from '../src/db/events';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
let typeId: (k: string) => number;
beforeEach(() => ({ db, seriesId, typeId } = setup()));

const newEvent = (name: string) => createEntity(db, { seriesId, typeId: typeId('event'), name });
const base: EventInput = {
  mode: 'present', bookId: null, toldById: null, datePrecision: null, year: null, ageId: null,
  relativeTo: null, offsetYears: null, bucket: null, sortKeyOverride: null, manualOrder: 0,
};
const key = (id: number) => getEventDetail(db, id)!.sortKey;

describe('saveEvent', () => {
  it('stores mode, book and teller, and computes the key and label', () => {
    const book = addBook(db, seriesId, 'One');
    const bard = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Bard' });
    const age = createAge(db, seriesId, { name: 'Third Age', startYear: 1000, endYear: null, direction: 'forward' });
    const id = newEvent('Fall');
    saveEvent(db, id, { ...base, mode: 'recounted', bookId: book, toldById: bard, datePrecision: 'year', year: 12, ageId: age });
    expect(getEventDetail(db, id)).toMatchObject({
      mode: 'recounted', book: { id: book, number: 1 }, toldBy: { id: bard, name: 'Bard' },
      sortKey: 1012, effectiveKey: 1012, label: 'Year 12, Third Age',
    });
  });

  it('clears fields the chosen precision does not use, and drops told-by for present events', () => {
    const bard = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Bard' });
    const id = newEvent('Fall');
    saveEvent(db, id, { ...base, toldById: bard, datePrecision: 'bucket', year: 5, bucket: 'mythic', offsetYears: 3 });
    expect(db.query('SELECT year, offset_years, bucket, told_by_entity_id FROM event WHERE entity_id = ?', [id])).toEqual([
      { year: null, offset_years: null, bucket: 'mythic', told_by_entity_id: null },
    ]);
  });

  it('rejects incomplete dates with a clear message', () => {
    const id = newEvent('Fall');
    expect(() => saveEvent(db, id, { ...base, datePrecision: 'year' })).toThrow(/year/i);
    expect(() => saveEvent(db, id, { ...base, datePrecision: 'relative' })).toThrow(/which event/i);
  });

  it('recomputes downstream relatives when the anchor moves', () => {
    const a = newEvent('A');
    const b = newEvent('B');
    const c = newEvent('C');
    saveEvent(db, a, { ...base, datePrecision: 'year', year: 10 });
    saveEvent(db, b, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 5 });
    saveEvent(db, c, { ...base, datePrecision: 'relative', relativeTo: b, offsetYears: -2 });
    expect([key(b), key(c)]).toEqual([15, 13]);
    saveEvent(db, a, { ...base, datePrecision: 'year', year: 100 });
    expect([key(b), key(c)]).toEqual([105, 103]);
    expect(getEventDetail(db, c)!.label).toBe('2 years before B');
  });

  it('rejects cycles and targets that are not events of this series', () => {
    const a = newEvent('A');
    const b = newEvent('B');
    saveEvent(db, b, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 1 });
    expect(() => saveEvent(db, a, { ...base, datePrecision: 'relative', relativeTo: b, offsetYears: 1 })).toThrow(/loop/i);
    expect(() => saveEvent(db, a, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 1 })).toThrow(/loop/i);
    const person = createEntity(db, { seriesId, typeId: typeId('character'), name: 'P' });
    expect(() => saveEvent(db, a, { ...base, datePrecision: 'relative', relativeTo: person })).toThrow(/event/i);
  });

  it('honours the pin override for itself and its dependents', () => {
    const a = newEvent('A');
    const b = newEvent('B');
    saveEvent(db, a, { ...base, datePrecision: 'year', year: 1, sortKeyOverride: 500 });
    saveEvent(db, b, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 1 });
    expect(getEventDetail(db, a)).toMatchObject({ sortKey: 1, effectiveKey: 500, label: 'Year 1 (pinned)' });
    expect(key(b)).toBe(501);
  });
});

describe('deleting or retyping an anchor freezes its dependents', () => {
  it('converts dependents to a plain year at their current position', () => {
    const a = newEvent('A');
    const b = newEvent('B');
    const c = newEvent('C');
    saveEvent(db, a, { ...base, datePrecision: 'year', year: 10 });
    saveEvent(db, b, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 5 });
    saveEvent(db, c, { ...base, datePrecision: 'relative', relativeTo: b, offsetYears: 1 });
    deleteEntity(db, a);
    expect(getEventDetail(db, b)).toMatchObject({ datePrecision: 'year', year: 15, sortKey: 15 });
    expect(key(c)).toBe(16);

    updateEntity(db, b, { typeId: typeId('lore') });
    expect(getEventDetail(db, c)).toMatchObject({ datePrecision: 'year', year: 16 });
  });

  it('makes dependents of an undated anchor undated', () => {
    const a = newEvent('A');
    const b = newEvent('B');
    saveEvent(db, b, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 5 });
    deleteEntity(db, a);
    expect(getEventDetail(db, b)).toMatchObject({ datePrecision: null, sortKey: null, label: 'Undated' });
  });

  it('lets a whole series with relative events be deleted', () => {
    const a = newEvent('A');
    const b = newEvent('B');
    saveEvent(db, b, { ...base, datePrecision: 'relative', relativeTo: a, offsetYears: 5 });
    deleteSeries(db, seriesId);
    expect(db.query('SELECT COUNT(*) AS n FROM event')).toEqual([{ n: 0 }]);
  });
});

describe('participants', () => {
  it('adds with a default role by type, edits the role, removes', () => {
    const ev = newEvent('Battle');
    const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    const field = createEntity(db, { seriesId, typeId: typeId('location'), name: 'Field' });
    const p1 = addParticipant(db, ev, hero);
    addParticipant(db, ev, field);
    addParticipant(db, ev, hero, 'leader');
    expect(getEventDetail(db, ev)!.participants.map((p) => `${p.name}:${p.role}`)).toEqual([
      'Field:location', 'Hero:leader', 'Hero:participant',
    ]);
    updateParticipantRole(db, p1, '  witness ');
    removeParticipant(db, p1);
    expect(getEventDetail(db, ev)!.participants.map((p) => p.role)).toEqual(['location', 'leader']);
  });

  it('rejects duplicates, the event itself, and entries from other series', () => {
    const ev = newEvent('Battle');
    const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    addParticipant(db, ev, hero);
    expect(() => addParticipant(db, ev, hero)).toThrow(/already/i);
    expect(() => addParticipant(db, ev, ev)).toThrow(/itself/i);
    const other = createSeries(db, { name: 'Other' });
    const otherType = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'item'`, [other])[0].id;
    const foreign = createEntity(db, { seriesId: other, typeId: otherType, name: 'F' });
    expect(() => addParticipant(db, ev, foreign)).toThrow(/series/i);
  });

  it('rejects renaming a role to one the entry already has, and missing participants', () => {
    const ev = newEvent('Battle');
    const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    const p1 = addParticipant(db, ev, hero);
    addParticipant(db, ev, hero, 'leader');
    expect(() => updateParticipantRole(db, p1, 'leader')).toThrow('Hero is already listed as leader.');
    updateParticipantRole(db, p1, 'participant'); // unchanged role is fine
    expect(() => updateParticipantRole(db, 9999, 'leader')).toThrow(/no longer exists/);
  });

  it('lists an entry\'s events in story order, undated last', () => {
    const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero' });
    const late = newEvent('Late');
    const early = newEvent('Early');
    const someday = newEvent('Someday');
    saveEvent(db, late, { ...base, datePrecision: 'year', year: 50 });
    saveEvent(db, early, { ...base, datePrecision: 'bucket', bucket: 'ancient' });
    for (const e of [late, early, someday]) addParticipant(db, e, hero);
    expect(eventsForEntity(db, hero).map((e) => `${e.name}|${e.label}|${e.role}`)).toEqual([
      'Early|In ancient times|participant', 'Late|Year 50|participant', 'Someday|Undated|participant',
    ]);
  });

  it('includes recounted events the entry tells', () => {
    const bard = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Bard' });
    const legend = newEvent('Legend');
    saveEvent(db, legend, { ...base, mode: 'recounted', toldById: bard, datePrecision: 'bucket', bucket: 'mythic' });
    expect(eventsForEntity(db, bard).map((e) => `${e.name}|${e.role}|${e.mode}`)).toEqual(['Legend|told by|recounted']);
  });
});
