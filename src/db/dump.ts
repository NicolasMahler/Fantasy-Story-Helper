import type { SqlDb } from './types';
import { currentVersion } from './migrations';

export interface JsonDump {
  format: 'fantasy-helper';
  schemaVersion: number;
  exportedAt: string;
  /** Present when the dump holds a single series. */
  seriesName?: string;
  tables: Record<string, Record<string, unknown>[]>;
}

/** User-data tables in dependency order (parents first). `app_meta` is deliberately excluded. */
export const DATA_TABLES = [
  'series', 'book', 'age', 'entity_type', 'bucket_default', 'entity', 'event', 'event_participant', 'entity_link', 'mention',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

const inSeriesEntities = 'SELECT id FROM entity WHERE series_id = ?';
const SERIES_FILTER: Record<DataTable, string> = {
  series: 'id = ?',
  book: 'series_id = ?',
  age: 'series_id = ?',
  entity_type: 'series_id = ?',
  bucket_default: 'series_id = ?',
  entity: 'series_id = ?',
  event: `entity_id IN (${inSeriesEntities})`,
  event_participant: `event_id IN (${inSeriesEntities})`,
  entity_link: `from_entity_id IN (${inSeriesEntities})`,
  mention: `source_entity_id IN (${inSeriesEntities})`,
};

/** JSON export of all data, or of one series when `seriesId` is given. */
export function dumpJson(db: SqlDb, seriesId?: number): JsonDump {
  const tables: JsonDump['tables'] = {};
  for (const t of DATA_TABLES) {
    tables[t] = seriesId === undefined
      ? db.query(`SELECT * FROM "${t}"`)
      : db.query(`SELECT * FROM "${t}" WHERE ${SERIES_FILTER[t]}`, [seriesId]);
  }
  const dump: JsonDump = {
    format: 'fantasy-helper',
    schemaVersion: currentVersion(db),
    exportedAt: new Date().toISOString(),
    tables,
  };
  if (seriesId !== undefined) dump.seriesName = tables.series[0]?.name as string | undefined;
  return dump;
}
