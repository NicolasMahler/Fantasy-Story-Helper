import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDb } from '../../src/db/types';

/** In-memory node:sqlite database behind the SqlDb interface, foreign keys on. */
export function openNodeDb(): SqlDb {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  let depth = 0;
  const api: SqlDb = {
    exec(sql, params) {
      if (params?.length) db.prepare(sql).run(...(params as SQLInputValue[]));
      else db.exec(sql);
    },
    query<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as SQLInputValue[])).map((r) => ({ ...r })) as T[];
    },
    transaction(fn) {
      const sp = `sp${depth++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try {
        const out = fn();
        db.exec(`RELEASE ${sp}`);
        return out;
      } catch (e) {
        db.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return api;
}
