import { describe, it, expect, beforeEach } from 'vitest';
import { openNodeDb } from './helpers/nodeDb';
import { migrate } from '../src/db/migrations';
import { createSeries, deleteSeries, DEFAULT_ENTITY_TYPES, DEFAULT_BUCKETS } from '../src/db/seed';
import type { SqlDb } from '../src/db/types';

let db: SqlDb;
beforeEach(() => {
  db = openNodeDb();
  migrate(db);
});

const count = (sql: string, params: unknown[] = []) =>
  db.query<{ n: number }>(sql, params)[0].n;

describe('createSeries', () => {
  it('inserts the series with default types and buckets', () => {
    const id = createSeries(db, { name: 'The Long Saga' });
    expect(db.query('SELECT name, description FROM series WHERE id = ?', [id])).toEqual([
      { name: 'The Long Saga', description: '' },
    ]);
    const keys = db
      .query<{ key: string }>('SELECT key FROM entity_type WHERE series_id = ? ORDER BY sort_order', [id])
      .map((r) => r.key);
    expect(keys).toEqual([
      'character', 'location', 'event', 'people', 'faction',
      'item', 'magic', 'creature', 'religion', 'lore',
    ]);
    expect(DEFAULT_ENTITY_TYPES).toHaveLength(10);
    expect(
      db.query('SELECT key FROM entity_type WHERE series_id = ? AND is_builtin = 1', [id]),
    ).toEqual([{ key: 'event' }]);
    expect(
      db.query('SELECT bucket, sort_key FROM bucket_default WHERE series_id = ? ORDER BY sort_key', [id]),
    ).toEqual([
      { bucket: 'mythic', sort_key: -1000000 },
      { bucket: 'ancient', sort_key: -100000 },
      { bucket: 'distant', sort_key: -10000 },
      { bucket: 'recent', sort_key: -100 },
      { bucket: 'present', sort_key: 0 },
    ]);
    expect(DEFAULT_BUCKETS).toHaveLength(5);
  });

  it('keeps each series independent', () => {
    const a = createSeries(db, { name: 'A' });
    const b = createSeries(db, { name: 'B' });
    expect(a).not.toBe(b);
    expect(count('SELECT COUNT(*) AS n FROM entity_type')).toBe(20);
  });

  it('rejects a blank name', () => {
    expect(() => createSeries(db, { name: '   ' })).toThrow(/name/i);
    expect(count('SELECT COUNT(*) AS n FROM series')).toBe(0);
  });
});

describe('deleteSeries', () => {
  it('cascades to everything under the series', () => {
    const id = createSeries(db, { name: 'Doomed' });
    const type = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE key = 'event' AND series_id = ?`, [id])[0].id;
    db.exec('INSERT INTO book (series_id, number, title) VALUES (?, 1, ?)', [id, 'Book One']);
    db.exec('INSERT INTO entity (series_id, type_id, name) VALUES (?, ?, ?)', [id, type, 'The Fall']);
    db.exec('INSERT INTO event (entity_id) VALUES (last_insert_rowid())');

    deleteSeries(db, id);
    for (const t of ['series', 'book', 'entity_type', 'entity', 'event', 'bucket_default']) {
      expect(count(`SELECT COUNT(*) AS n FROM ${t}`), t).toBe(0);
    }
  });
});
