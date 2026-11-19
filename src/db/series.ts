import type { SqlDb } from './types';

export interface SeriesRow {
  id: number;
  name: string;
  description: string;
  books: number;
  entities: number;
}

const SELECT = `
  SELECT s.id, s.name, s.description,
         (SELECT COUNT(*) FROM book b WHERE b.series_id = s.id)   AS books,
         (SELECT COUNT(*) FROM entity e WHERE e.series_id = s.id) AS entities
  FROM series s`;

export function listSeries(db: SqlDb): SeriesRow[] {
  return db.query<SeriesRow>(`${SELECT} ORDER BY s.name COLLATE NOCASE`);
}

export function getSeries(db: SqlDb, id: number): SeriesRow | null {
  return db.query<SeriesRow>(`${SELECT} WHERE s.id = ?`, [id])[0] ?? null;
}

export function updateSeries(db: SqlDb, id: number, input: { name: string; description: string }): void {
  const name = input.name.trim();
  if (!name) throw new Error('Series name is required.');
  db.exec(`UPDATE series SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?`, [
    name, input.description.trim(), id,
  ]);
}
