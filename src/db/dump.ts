import type { SqlDb } from './types';
import { currentVersion } from './migrations';

export interface JsonDump {
  format: 'fantasy-helper';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** Full JSON export of every user table (backup / portability). */
export function dumpJson(db: SqlDb): JsonDump {
  const names = db
    .query<{ name: string }>(
      `SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .map((r) => r.name);
  const tables: JsonDump['tables'] = {};
  for (const name of names) tables[name] = db.query(`SELECT * FROM "${name}"`);
  return {
    format: 'fantasy-helper',
    schemaVersion: currentVersion(db),
    exportedAt: new Date().toISOString(),
    tables,
  };
}
