import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity } from '../src/db/entities';
import { listAges, createAge, updateAge, deleteAge, listBuckets, updateBucket } from '../src/db/calendar';
import { saveEvent, getEventDetail, type EventInput } from '../src/db/events';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
let seriesId: number;
let typeId: (k: string) => number;
beforeEach(() => ({ db, seriesId, typeId } = setup()));

const base: EventInput = {
  mode: 'present', bookId: null, toldById: null, datePrecision: null, year: null, ageId: null,
  relativeTo: null, offsetYears: null, bucket: null, sortKeyOverride: null, manualOrder: 0,
};

describe('ages', () => {
  it('creates and lists ages by start year with usage counts', () => {
    createAge(db, seriesId, { name: 'Second', startYear: 500, endYear: 999, direction: 'forward' });
    createAge(db, seriesId, { name: 'First', startYear: 0, endYear: 499, direction: 'forward' });
    expect(listAges(db, seriesId).map((a) => `${a.name}:${a.start_year}-${a.end_year}:${a.usage}`)).toEqual([
      'First:0-499:0', 'Second:500-999:0',
    ]);
  });

  it('validates name, whole years and duplicates', () => {
    expect(() => createAge(db, seriesId, { name: ' ', startYear: 0, endYear: null, direction: 'forward' })).toThrow(/name/i);
    expect(() => createAge(db, seriesId, { name: 'X', startYear: 1.5, endYear: null, direction: 'forward' })).toThrow(/whole/i);
    createAge(db, seriesId, { name: 'X', startYear: 0, endYear: null, direction: 'forward' });
    expect(() => createAge(db, seriesId, { name: 'x', startYear: 5, endYear: null, direction: 'forward' })).toThrow(/already/i);
  });

  it('recomputes event keys when an age moves or flips direction', () => {
    const age = createAge(db, seriesId, { name: 'Third', startYear: 1000, endYear: null, direction: 'forward' });
    const ev = createEntity(db, { seriesId, typeId: typeId('event'), name: 'E' });
    saveEvent(db, ev, { ...base, datePrecision: 'year', year: 10, ageId: age });
    expect(getEventDetail(db, ev)!.sortKey).toBe(1010);
    updateAge(db, age, { name: 'Third', startYear: 2000, endYear: null, direction: 'backward' });
    expect(getEventDetail(db, ev)!.sortKey).toBe(1990);
  });

  it('refuses to delete an age in use', () => {
    const age = createAge(db, seriesId, { name: 'Third', startYear: 0, endYear: null, direction: 'forward' });
    const ev = createEntity(db, { seriesId, typeId: typeId('event'), name: 'E' });
    saveEvent(db, ev, { ...base, datePrecision: 'age', ageId: age });
    expect(() => deleteAge(db, age)).toThrow(/1 event/);
    saveEvent(db, ev, base);
    deleteAge(db, age);
    expect(listAges(db, seriesId)).toEqual([]);
  });
});

describe('vague-date buckets', () => {
  it('edits label and position, and recomputes events', () => {
    const ev = createEntity(db, { seriesId, typeId: typeId('event'), name: 'E' });
    saveEvent(db, ev, { ...base, datePrecision: 'bucket', bucket: 'distant' });
    updateBucket(db, seriesId, 'distant', { label: 'Ages past', sortKey: -5000 });
    expect(listBuckets(db, seriesId).find((b) => b.bucket === 'distant')).toMatchObject({ label: 'Ages past', sort_key: -5000, usage: 1 });
    expect(getEventDetail(db, ev)).toMatchObject({ sortKey: -5000, label: 'Ages past' });
  });

  it('rejects a blank label or non-number position', () => {
    expect(() => updateBucket(db, seriesId, 'distant', { label: '', sortKey: 1 })).toThrow(/label/i);
    expect(() => updateBucket(db, seriesId, 'distant', { label: 'x', sortKey: Number.NaN })).toThrow(/number/i);
  });
});
