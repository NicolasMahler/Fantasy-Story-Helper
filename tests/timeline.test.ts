import { describe, it, expect } from 'vitest';
import { setup } from './helpers/fixture';
import { createEntity } from '../src/db/entities';
import { addBook } from '../src/db/books';
import { createAge } from '../src/db/calendar';
import { saveEvent, addParticipant, type EventInput } from '../src/db/events';
import { getTimeline } from '../src/db/timeline';

const base: EventInput = {
  mode: 'present', bookId: null, toldById: null, datePrecision: null, year: null, ageId: null,
  relativeTo: null, offsetYears: null, bucket: null, sortKeyOverride: null, manualOrder: 0,
};

describe('getTimeline', () => {
  it('returns every event with lane, labels, book, teller and participants', () => {
    const { db, seriesId, typeId } = setup();
    const book = addBook(db, seriesId, 'One');
    const age = createAge(db, seriesId, { name: 'Third', startYear: 1000, endYear: null, direction: 'forward' });
    const bard = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Bard' });
    const war = createEntity(db, { seriesId, typeId: typeId('event'), name: 'War' });
    const song = createEntity(db, { seriesId, typeId: typeId('event'), name: 'Song' });
    const after = createEntity(db, { seriesId, typeId: typeId('event'), name: 'After' });
    createEntity(db, { seriesId, typeId: typeId('event'), name: 'Someday' });
    saveEvent(db, war, { ...base, bookId: book, datePrecision: 'year', year: 12, ageId: age });
    saveEvent(db, song, { ...base, mode: 'recounted', toldById: bard, datePrecision: 'bucket', bucket: 'mythic' });
    saveEvent(db, after, { ...base, datePrecision: 'relative', relativeTo: war, offsetYears: 3, sortKeyOverride: 1015 });
    addParticipant(db, war, bard, 'leader');

    const t = getTimeline(db, seriesId);
    expect(t.books).toEqual([{ id: book, number: 1, title: 'One' }]);
    expect(t.ages.map((a) => a.name)).toEqual(['Third']);
    const byName = Object.fromEntries(t.events.map((e) => [e.name, e]));
    expect(byName.War).toMatchObject({
      effectiveKey: 1012, laneAgeId: age, short: '12', label: 'Year 12, Third', bookNumber: 1, bookTitle: 'One',
      participants: [{ entityId: bard, name: 'Bard', typeKey: 'character', role: 'leader' }],
    });
    expect(byName.After).toMatchObject({ effectiveKey: 1015, laneAgeId: age, short: '15', pinned: true });
    expect(byName.War.pinned).toBe(false);
    expect(byName.Song).toMatchObject({ mode: 'recounted', laneAgeId: null, short: 'In myth', toldBy: { id: bard, name: 'Bard' } });
    expect(byName.Someday).toMatchObject({ effectiveKey: null, short: '', label: 'Undated' });
  });
});
