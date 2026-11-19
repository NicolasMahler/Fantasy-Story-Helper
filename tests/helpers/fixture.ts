import { openNodeDb } from './nodeDb';
import { migrate } from '../../src/db/migrations';
import { createSeries } from '../../src/db/seed';
import type { SqlDb } from '../../src/db/types';

/** Migrated in-memory DB with one seeded series. */
export function setup(): { db: SqlDb; seriesId: number; typeId: (key: string) => number } {
  const db = openNodeDb();
  migrate(db);
  const seriesId = createSeries(db, { name: 'Saga' });
  const typeId = (key: string) =>
    db.query<{ id: number }>('SELECT id FROM entity_type WHERE series_id = ? AND key = ?', [seriesId, key])[0].id;
  return { db, seriesId, typeId };
}
