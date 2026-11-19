import type { SqlDb } from './types';
import { insertId } from './sql';
import { recomputeSeries } from './events';

export interface AgeRow {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  direction: 'forward' | 'backward';
  /** Events dated in this age. */
  usage: number;
}

export interface AgeInput {
  name: string;
  startYear: number;
  endYear: number | null;
  direction: 'forward' | 'backward';
}

export interface BucketRow {
  bucket: string;
  label: string;
  sort_key: number;
  usage: number;
}

export function listAges(db: SqlDb, seriesId: number): AgeRow[] {
  return db.query<AgeRow>(
    `SELECT a.id, a.name, a.start_year, a.end_year, a.direction,
            (SELECT COUNT(*) FROM event ev WHERE ev.age_id = a.id) AS usage
     FROM age a WHERE a.series_id = ? ORDER BY a.start_year, a.id`,
    [seriesId],
  );
}

function validateAge(db: SqlDb, seriesId: number, input: AgeInput, selfId: number | null): AgeInput {
  const name = input.name.trim();
  if (!name) throw new Error('Age name is required.');
  if (!Number.isInteger(input.startYear)) throw new Error('Start year must be a whole number.');
  if (input.endYear !== null && !Number.isInteger(input.endYear)) throw new Error('End year must be a whole number.');
  if (input.direction !== 'forward' && input.direction !== 'backward') throw new Error('Unknown direction.');
  const clash = db.query<{ id: number }>('SELECT id FROM age WHERE series_id = ? AND name = ? COLLATE NOCASE', [seriesId, name]);
  if (clash.some((c) => c.id !== selfId)) throw new Error(`An age called “${name}” already exists.`);
  return { ...input, name };
}

export function createAge(db: SqlDb, seriesId: number, input: AgeInput): number {
  const a = validateAge(db, seriesId, input, null);
  db.exec('INSERT INTO age (series_id, name, start_year, end_year, direction) VALUES (?, ?, ?, ?, ?)', [
    seriesId, a.name, a.startYear, a.endYear, a.direction,
  ]);
  return insertId(db);
}

export function updateAge(db: SqlDb, id: number, input: AgeInput): void {
  db.transaction(() => {
    const [row] = db.query<{ series_id: number }>('SELECT series_id FROM age WHERE id = ?', [id]);
    if (!row) throw new Error('Age not found.');
    const a = validateAge(db, row.series_id, input, id);
    db.exec('UPDATE age SET name = ?, start_year = ?, end_year = ?, direction = ? WHERE id = ?', [
      a.name, a.startYear, a.endYear, a.direction, id,
    ]);
    recomputeSeries(db, row.series_id);
  });
}

export function deleteAge(db: SqlDb, id: number): void {
  const [n] = db.query<{ n: number }>('SELECT COUNT(*) AS n FROM event WHERE age_id = ?', [id]);
  if (n.n > 0) throw new Error(`This age is used by ${n.n} ${n.n === 1 ? 'event' : 'events'}. Re-date them first.`);
  db.exec('DELETE FROM age WHERE id = ?', [id]);
}

export function listBuckets(db: SqlDb, seriesId: number): BucketRow[] {
  return db.query<BucketRow>(
    `SELECT b.bucket, b.label, b.sort_key,
            (SELECT COUNT(*) FROM event ev JOIN entity e ON e.id = ev.entity_id
             WHERE e.series_id = b.series_id AND ev.bucket = b.bucket) AS usage
     FROM bucket_default b WHERE b.series_id = ? ORDER BY b.sort_key`,
    [seriesId],
  );
}

export function updateBucket(db: SqlDb, seriesId: number, bucket: string, input: { label: string; sortKey: number }): void {
  const label = input.label.trim();
  if (!label) throw new Error('Label is required.');
  if (!Number.isFinite(input.sortKey)) throw new Error('Position must be a number.');
  db.transaction(() => {
    db.exec('UPDATE bucket_default SET label = ?, sort_key = ? WHERE series_id = ? AND bucket = ?', [
      label, input.sortKey, seriesId, bucket,
    ]);
    recomputeSeries(db, seriesId);
  });
}
