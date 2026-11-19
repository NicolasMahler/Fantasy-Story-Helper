import { describe, it, expect } from 'vitest';
import { openNodeDb } from './helpers/nodeDb';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import { createSeries } from '../src/db/seed';
import { dumpJson } from '../src/db/dump';

describe('dumpJson', () => {
  it('dumps every table with its rows', () => {
    const db = openNodeDb();
    migrate(db);
    createSeries(db, { name: 'Saga' });
    const dump = dumpJson(db);
    expect(dump.format).toBe('fantasy-helper');
    expect(dump.schemaVersion).toBe(MIGRATIONS.length);
    expect(Number.isNaN(Date.parse(dump.exportedAt))).toBe(false);
    expect(Object.keys(dump.tables)).toHaveLength(10);
    expect(dump.tables.series).toHaveLength(1);
    expect(dump.tables.entity_type).toHaveLength(10);
    expect(dump.tables.bucket_default).toHaveLength(5);
    expect(dump.tables.entity).toEqual([]);
  });
});
