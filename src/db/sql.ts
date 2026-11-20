/** Small SQL helpers shared by the domain modules. */
import type { SqlDb } from './types';

/** Row id of the most recent INSERT on this connection. */
export const insertId = (db: SqlDb): number => db.query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id;

/** Escapes `\`, `%` and `_` for use in `LIKE ? ESCAPE '\'`. */
export const likeEscape = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
