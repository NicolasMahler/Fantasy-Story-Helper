/** Small SQL helpers shared by the domain modules. */
import type { SqlDb } from './types';

/** Row id of the most recent INSERT on this connection. */
export const insertId = (db: SqlDb): number => db.query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id;

/** Escapes `\`, `%` and `_` for use in `LIKE ? ESCAPE '\'`. */
export const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Tables whose rows carry a series_id. */
export type SeriesTable = 'entity' | 'book' | 'age';

/** The series an entry, book or age belongs to; undefined if it doesn't exist. */
export const seriesOf = (db: SqlDb, table: SeriesTable, id: number): number | undefined =>
  db.query<{ series_id: number }>(`SELECT series_id FROM ${table} WHERE id = ?`, [id])[0]?.series_id;

/** Whether the entry, book or age exists and belongs to `seriesId`. */
export const inSeries = (db: SqlDb, table: SeriesTable, id: number, seriesId: number): boolean =>
  seriesOf(db, table, id) === seriesId;

/** Throws unless `bookId` is null or a book of the series; returns it. */
export function bookInSeries(db: SqlDb, seriesId: number, bookId: number | null | undefined): number | null {
  if (bookId == null) return null;
  if (!inSeries(db, 'book', bookId, seriesId)) throw new Error('That book does not belong to this series.');
  return bookId;
}

/** The series of an event or theory entry (one with a row in that extension table); undefined if it has none. */
export const extensionSeries = (db: SqlDb, table: 'event' | 'theory', id: number): number | undefined =>
  db.query<{ series_id: number }>(
    `SELECT e.series_id FROM ${table} x JOIN entity e ON e.id = x.entity_id WHERE x.entity_id = ?`, [id],
  )[0]?.series_id;
