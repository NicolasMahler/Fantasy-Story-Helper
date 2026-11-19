import { describe, it, expect } from 'vitest';
import { openNodeDb } from './helpers/nodeDb';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import { createSeries } from '../src/db/seed';
import { dumpJson, DATA_TABLES } from '../src/db/dump';
import { createEntity } from '../src/db/entities';
import { recordExport } from '../src/db/meta';

describe('dumpJson', () => {
  it('dumps every data table with its rows, but not app settings', () => {
    const db = openNodeDb();
    migrate(db);
    createSeries(db, { name: 'Saga' });
    recordExport(db);
    const dump = dumpJson(db);
    expect(dump.format).toBe('fantasy-helper');
    expect(dump.schemaVersion).toBe(MIGRATIONS.length);
    expect(Number.isNaN(Date.parse(dump.exportedAt))).toBe(false);
    expect(Object.keys(dump.tables)).toEqual([...DATA_TABLES]);
    expect(dump.tables.series).toHaveLength(1);
    expect(dump.tables.entity_type).toHaveLength(10);
    expect(dump.tables.bucket_default).toHaveLength(5);
    expect(dump.tables.entity).toEqual([]);
    expect(dump.seriesName).toBeUndefined();
  });

  it('dumps a single series', () => {
    const db = openNodeDb();
    migrate(db);
    const a = createSeries(db, { name: 'A' });
    const b = createSeries(db, { name: 'B' });
    const typeB = db.query<{ id: number }>(`SELECT id FROM entity_type WHERE series_id = ? AND key = 'item'`, [b])[0].id;
    createEntity(db, { seriesId: b, typeId: typeB, name: 'Sword' });
    const dump = dumpJson(db, a);
    expect(dump.seriesName).toBe('A');
    expect(dump.tables.series.map((s) => s.name)).toEqual(['A']);
    expect(dump.tables.entity_type).toHaveLength(10);
    expect(dump.tables.entity).toEqual([]);
  });
});
