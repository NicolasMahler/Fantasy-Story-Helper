import { describe, it, expect, beforeEach } from 'vitest';
import { openNodeDb } from './helpers/nodeDb';
import { setup } from './helpers/fixture';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import { createSeries } from '../src/db/seed';
import { createEntity, getEntity, backlinks } from '../src/db/entities';
import { addBook } from '../src/db/books';
import { createAge } from '../src/db/calendar';
import { saveEvent, addParticipant, getEventDetail, type EventInput } from '../src/db/events';
import { createLink, listLinks } from '../src/db/links';
import { saveTheory, getTheoryDetail } from '../src/db/theories';
import { dumpJson } from '../src/db/dump';
import { validateDump, importJson } from '../src/db/transfer';
import { getMeta, recordExport } from '../src/db/meta';
import type { SqlDb } from '../src/db/types';

const base: EventInput = {
  mode: 'present', bookId: null, toldById: null, datePrecision: null, year: null, ageId: null,
  relativeTo: null, offsetYears: null, bucket: null, sortKeyOverride: null, manualOrder: 0,
};

/** A small but fully linked series: book, age, entries with @-links, dated + relative events, participants, link. */
function populate(db: SqlDb, seriesId: number, typeId: (k: string) => number) {
  const book = addBook(db, seriesId, 'One');
  const age = createAge(db, seriesId, { name: 'Third', startYear: 1000, endYear: null, direction: 'forward' });
  const hero = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero', firstBookId: book });
  const bard = createEntity(db, { seriesId, typeId: typeId('character'), name: 'Bard' });
  const war = createEntity(db, { seriesId, typeId: typeId('event'), name: 'War' });
  const peace = createEntity(db, { seriesId, typeId: typeId('event'), name: 'Peace' });
  createEntity(db, { seriesId, typeId: typeId('lore'), name: 'Song', description: `About @[Hero](${hero}) and @[War](${war}).` });
  saveEvent(db, war, { ...base, bookId: book, datePrecision: 'year', year: 5, ageId: age });
  saveEvent(db, peace, { ...base, mode: 'recounted', toldById: bard, datePrecision: 'relative', relativeTo: war, offsetYears: 10 });
  addParticipant(db, war, hero, 'leader');
  createLink(db, { fromId: hero, toId: bard, kind: 'friends', startEventId: war });
  const guess = createEntity(db, { seriesId, typeId: typeId('theory'), name: 'Bard is a spy' });
  saveTheory(db, guess, { kind: 'theory', status: 'confirmed', resolvedBookId: book, resolution: 'He confesses.' });
}

const count = (db: SqlDb, t: string) => db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;
const byName = (db: SqlDb, name: string, seriesId?: number) =>
  db.query<{ id: number }>(
    `SELECT id FROM entity WHERE name = ?${seriesId ? ' AND series_id = ?' : ''}`,
    seriesId ? [name, seriesId] : [name],
  )[0].id;

describe('validateDump', () => {
  it('accepts a real dump and rejects junk or newer versions', () => {
    const { db } = setup();
    expect(() => validateDump(dumpJson(db), MIGRATIONS.length)).not.toThrow();
    expect(() => validateDump({ hello: 1 }, MIGRATIONS.length)).toThrow(/not a Fantasy Helper/i);
    expect(() => validateDump('nope', MIGRATIONS.length)).toThrow(/not a Fantasy Helper/i);
    expect(() => validateDump({ ...dumpJson(db), schemaVersion: 99 }, MIGRATIONS.length)).toThrow(/newer/i);
    expect(() => validateDump({ ...dumpJson(db), tables: { series: 'x' } }, MIGRATIONS.length)).toThrow(/damaged/i);
  });
});

describe('importJson: older exports', () => {
  it('imports entries from a pre-v4 export with no other names', () => {
    const { db, seriesId, typeId } = setup();
    createEntity(db, { seriesId, typeId: typeId('character'), name: 'Hero', aliases: ['The Bold'] });
    const dump = JSON.parse(JSON.stringify(dumpJson(db)));
    dump.schemaVersion = 3;
    for (const row of dump.tables.entity) delete row.aliases;
    importJson(db, dump, 'replace');
    expect(getEntity(db, byName(db, 'Hero'))!.aliases).toEqual([]);
  });

  it('gives every series from a pre-v5 export the Theory type', () => {
    const { db } = setup();
    const dump = JSON.parse(JSON.stringify(dumpJson(db)));
    dump.schemaVersion = 4;
    delete dump.tables.theory;
    dump.tables.entity_type = dump.tables.entity_type.filter((t: { key: string }) => t.key !== 'theory');
    importJson(db, dump, 'replace');
    expect(db.query(`SELECT name, is_builtin FROM entity_type WHERE key = 'theory'`)).toEqual([{ name: 'Theory', is_builtin: 1 }]);
  });

  it('gives untouched built-in types from a pre-v3 export the line icons', () => {
    const { db } = setup();
    const dump = JSON.parse(JSON.stringify(dumpJson(db)));
    dump.schemaVersion = 2;
    const old: Record<string, string> = { character: '👤', faction: '🛡️', lore: '🧙' };
    for (const row of dump.tables.entity_type) if (row.key in old) row.icon = old[row.key];
    importJson(db, dump, 'replace');
    const icons = Object.fromEntries(
      db.query<{ key: string; icon: string }>(`SELECT key, icon FROM entity_type WHERE key IN ('character', 'faction', 'lore')`)
        .map((r) => [r.key, r.icon]),
    );
    expect(icons).toEqual({ character: 'user', faction: 'shield', lore: '🧙' });
  });
});

describe('importJson: replace', () => {
  it('round-trips everything and keeps app settings', () => {
    const { db, seriesId, typeId } = setup();
    populate(db, seriesId, typeId);
    recordExport(db, new Date('2026-01-01T00:00:00Z'));
    const dump = JSON.parse(JSON.stringify(dumpJson(db)));
    const before = Object.fromEntries(Object.entries(dump.tables).map(([t, rows]) => [t, (rows as unknown[]).length]));

    // Change the db, then restore.
    createSeries(db, { name: 'Scratch' });
    const result = importJson(db, dump, 'replace');
    expect(result).toEqual({ mode: 'replace', seriesIds: [seriesId] });
    for (const [t, n] of Object.entries(before)) expect(count(db, t), t).toBe(n);
    expect(getMeta(db, 'last_export_at')).toBe('2026-01-01T00:00:00.000Z');
    expect(getEventDetail(db, byName(db, 'Peace'))).toMatchObject({ sortKey: 1015, toldBy: { name: 'Bard' } });
  });

  it('leaves data untouched when the file is broken', () => {
    const { db, seriesId, typeId } = setup();
    populate(db, seriesId, typeId);
    const dump = dumpJson(db);
    dump.tables.entity.push({ id: 9999, series_id: 424242, type_id: 1, name: 'Orphan', description: '', attributes: '{}' });
    const n = count(db, 'entity');
    expect(() => importJson(db, dump, 'replace')).toThrow();
    expect(count(db, 'entity')).toBe(n);
    expect(count(db, 'series')).toBe(1);
  });
});

describe('importJson: add', () => {
  let db: SqlDb;
  let seriesId: number;
  beforeEach(() => {
    let typeId: (k: string) => number;
    ({ db, seriesId, typeId } = setup());
    populate(db, seriesId, typeId);
  });

  it('adds a copy as a new series with every reference remapped', () => {
    const dump = dumpJson(db, seriesId);
    const { seriesIds } = importJson(db, dump, 'add');
    expect(seriesIds).toHaveLength(1);
    const copy = seriesIds[0];
    expect(copy).not.toBe(seriesId);
    expect(db.query('SELECT name FROM series ORDER BY id')).toEqual([{ name: 'Saga' }, { name: 'Saga (imported)' }]);
    expect(count(db, 'entity')).toBe(2 * 6);

    const hero = byName(db, 'Hero', copy);
    const war = byName(db, 'War', copy);
    const song = getEntity(db, byName(db, 'Song', copy))!;
    expect(song.description).toBe(`About @[Hero](${hero}) and @[War](${war}).`);
    expect(Object.keys(song.links).map(Number).sort()).toEqual([hero, war].sort());
    expect(backlinks(db, hero).map((b) => b.id)).toEqual([song.id]);
    expect(getEntity(db, hero)!.firstBook).toMatchObject({ title: 'One' });
    expect(getEntity(db, hero)!.firstBook!.id).not.toBe(getEntity(db, byName(db, 'Hero', seriesId))!.firstBook!.id);

    expect(getEventDetail(db, byName(db, 'Peace', copy))).toMatchObject({
      relativeTo: war, sortKey: 1015, toldBy: { id: byName(db, 'Bard', copy) },
    });
    expect(getEventDetail(db, war)!.participants.map((p) => [p.entityId, p.role])).toEqual([[hero, 'leader']]);
    expect(listLinks(db, hero)).toMatchObject([{ kind: 'friends', other: { name: 'Bard' }, startEvent: { id: war } }]);
    const guess = getTheoryDetail(db, byName(db, 'Bard is a spy', copy))!;
    expect(guess).toMatchObject({ status: 'confirmed', resolution: 'He confesses.', resolvedBook: { title: 'One' } });
    expect(guess.resolvedBook!.id).toBe(getEntity(db, hero)!.firstBook!.id);
  });

  it('numbers repeated imports and leaves the original untouched', () => {
    const dump = dumpJson(db, seriesId);
    importJson(db, dump, 'add');
    importJson(db, dump, 'add');
    expect(db.query<{ name: string }>('SELECT name FROM series ORDER BY id').map((r) => r.name)).toEqual([
      'Saga', 'Saga (imported)', 'Saga (imported 2)',
    ]);
    const original = getEntity(db, byName(db, 'Song', seriesId))!;
    expect(original.description).toContain(`@[Hero](${byName(db, 'Hero', seriesId)})`);
  });

  it('adds every series from a full dump into another database', () => {
    const other = openNodeDb();
    migrate(other);
    createSeries(other, { name: 'Existing' });
    const { seriesIds } = importJson(other, dumpJson(db), 'add');
    expect(seriesIds).toHaveLength(1);
    expect(other.query<{ name: string }>('SELECT name FROM series ORDER BY id').map((r) => r.name)).toEqual(['Existing', 'Saga']);
    expect(count(other, 'event_participant')).toBe(1);
  });
});
