import { describe, it, expect } from 'vitest';
import { openNodeDb } from './helpers/nodeDb';
import { migrate, MIGRATIONS, currentVersion } from '../src/db/migrations';

const objects = (db: ReturnType<typeof openNodeDb>, type: string) =>
  db
    .query<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      [type],
    )
    .map((r) => r.name);

describe('migrate', () => {
  it('creates all tables and views on a fresh db', () => {
    const db = openNodeDb();
    expect(migrate(db)).toBe(MIGRATIONS.length);
    expect(objects(db, 'table')).toEqual([
      'age', 'book', 'bucket_default', 'entity', 'entity_link', 'entity_type',
      'event', 'event_participant', 'mention', 'series',
    ]);
    expect(objects(db, 'view')).toEqual(['v_cooccurrence', 'v_timeline']);
  });

  it('is a no-op when already up to date', () => {
    const db = openNodeDb();
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
    expect(currentVersion(db)).toBe(MIGRATIONS.length);
  });

  it('rolls back a failing migration and keeps the prior version', () => {
    const db = openNodeDb();
    expect(() => migrate(db, ['CREATE TABLE ok (id INTEGER); THIS IS NOT SQL;'])).toThrow();
    expect(currentVersion(db)).toBe(0);
    expect(objects(db, 'table')).toEqual([]);
  });

  it('refuses a db from a newer app version', () => {
    const db = openNodeDb();
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 5}`);
    expect(() => migrate(db)).toThrow(/newer/);
  });
});
