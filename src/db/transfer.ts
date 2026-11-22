/** JSON import: replace everything, or add the file's series alongside existing data. */
import type { SqlDb } from './types';
import { insertId } from './sql';
import { currentVersion, LINE_ICONS_SQL, THEORY_TYPE_SQL } from './migrations';
import { DATA_TABLES, type DataTable, type JsonDump } from './dump';
import { detachRelativeDates, recomputeSeries } from './events';
import { MENTION_RE } from './mentions';

export type ImportMode = 'replace' | 'add';
export interface ImportResult {
  mode: ImportMode;
  /** Series ids now holding the imported data. */
  seriesIds: number[];
}

type Row = Record<string, unknown>;

/** Throws a readable error unless `x` is a dump this app version can read. */
export function validateDump(x: unknown, appVersion: number): JsonDump {
  const d = x as Partial<JsonDump> | null;
  if (!d || typeof d !== 'object' || d.format !== 'fantasy-helper' || typeof d.tables !== 'object' || d.tables === null) {
    throw new Error('That file is not a Fantasy Helper JSON export.');
  }
  if (!Number.isInteger(d.schemaVersion) || d.schemaVersion! < 1) throw new Error('That export has no valid schema version.');
  if (d.schemaVersion! > appVersion) {
    throw new Error(`That export comes from a newer version of the app (schema v${d.schemaVersion}, this app knows v${appVersion}).`);
  }
  for (const t of DATA_TABLES) {
    const rows = (d.tables as Record<string, unknown>)[t];
    if (rows !== undefined && (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object'))) {
      throw new Error(`That export looks damaged (table “${t}”).`);
    }
  }
  return d as JsonDump;
}

const rowsOf = (dump: JsonDump, t: DataTable): Row[] => (dump.tables[t] as Row[] | undefined) ?? [];

function columnsOf(db: SqlDb, t: DataTable): Set<string> {
  return new Set(db.query<{ name: string }>(`PRAGMA table_info("${t}")`).map((c) => c.name));
}

function insert(db: SqlDb, t: DataTable, row: Row, cols: Set<string>, skip: string[] = []): number {
  const keys = Object.keys(row).filter((k) => cols.has(k) && !skip.includes(k));
  db.exec(
    `INSERT INTO "${t}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => row[k]),
  );
  return insertId(db);
}

/** Replace mode: wipe all user data and load the dump, atomically. App settings (app_meta) are kept. */
function importReplace(db: SqlDb, dump: JsonDump): ImportResult {
  db.exec('PRAGMA defer_foreign_keys = ON');
  detachRelativeDates(db);
  for (const t of [...DATA_TABLES].reverse()) db.exec(`DELETE FROM "${t}"`);
  for (const t of DATA_TABLES) {
    const cols = columnsOf(db, t);
    for (const row of rowsOf(dump, t)) insert(db, t, row, cols);
  }
  return { mode: 'replace', seriesIds: db.query<{ id: number }>('SELECT id FROM series ORDER BY id').map((r) => r.id) };
}

/** Add mode: every series in the dump becomes a new series; all ids and references are remapped. */
function importAdd(db: SqlDb, dump: JsonDump): ImportResult {
  db.exec('PRAGMA defer_foreign_keys = ON');
  const maps: Record<string, Map<number, number>> = {
    series: new Map(), book: new Map(), age: new Map(), entity_type: new Map(), entity: new Map(), participant: new Map(),
  };
  const m = (map: Map<number, number>, v: unknown): number | null =>
    v === null || v === undefined ? null : (map.get(Number(v)) ?? null);

  // series (unique names)
  const taken = new Set(db.query<{ name: string }>('SELECT name FROM series').map((r) => r.name.toLowerCase()));
  const sCols = columnsOf(db, 'series');
  for (const s of rowsOf(dump, 'series')) {
    let name = String(s.name ?? 'Imported series');
    if (taken.has(name.toLowerCase())) {
      const baseName = `${name} (imported)`;
      name = baseName;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${baseName.slice(0, -1)} ${n})`;
    }
    taken.add(name.toLowerCase());
    maps.series.set(Number(s.id), insert(db, 'series', { ...s, name }, sCols, ['id']));
  }

  // children of series
  for (const t of ['book', 'age', 'entity_type'] as const) {
    const cols = columnsOf(db, t);
    for (const r of rowsOf(dump, t)) {
      const sid = m(maps.series, r.series_id);
      if (sid === null) continue;
      maps[t].set(Number(r.id), insert(db, t, { ...r, series_id: sid }, cols, ['id']));
    }
  }
  const bCols = columnsOf(db, 'bucket_default');
  for (const r of rowsOf(dump, 'bucket_default')) {
    const sid = m(maps.series, r.series_id);
    if (sid !== null) insert(db, 'bucket_default', { ...r, series_id: sid }, bCols);
  }

  // entities (descriptions rewritten after every id is known)
  const eCols = columnsOf(db, 'entity');
  const entities = rowsOf(dump, 'entity');
  for (const r of entities) {
    const sid = m(maps.series, r.series_id);
    const tid = m(maps.entity_type, r.type_id);
    if (sid === null || tid === null) continue;
    maps.entity.set(
      Number(r.id),
      insert(db, 'entity', { ...r, series_id: sid, type_id: tid, first_book_id: m(maps.book, r.first_book_id) }, eCols, ['id']),
    );
  }
  for (const r of entities) {
    const id = m(maps.entity, r.id);
    if (id === null || typeof r.description !== 'string' || !r.description.includes('@[')) continue;
    const text = r.description.replace(MENTION_RE, (_all, label: string, old: string) => {
      const n = maps.entity.get(Number(old));
      return n === undefined ? label : `@[${label}](${n})`;
    });
    db.exec('UPDATE entity SET description = ? WHERE id = ?', [text, id]);
  }

  // events
  const evCols = columnsOf(db, 'event');
  for (const r of rowsOf(dump, 'event')) {
    const id = m(maps.entity, r.entity_id);
    if (id === null) continue;
    const row: Row = {
      ...r,
      entity_id: id,
      book_id: m(maps.book, r.book_id),
      told_by_entity_id: m(maps.entity, r.told_by_entity_id),
      age_id: m(maps.age, r.age_id),
      relative_to_event: m(maps.entity, r.relative_to_event),
    };
    // A reference that didn't come along must not leave a date the CHECKs reject.
    if (row.date_precision === 'relative' && row.relative_to_event === null) Object.assign(row, { date_precision: null, offset_years: null });
    if (row.date_precision === 'age' && row.age_id === null) row.date_precision = null;
    insert(db, 'event', row, evCols);
  }

  const thCols = columnsOf(db, 'theory');
  for (const r of rowsOf(dump, 'theory')) {
    const id = m(maps.entity, r.entity_id);
    if (id !== null) insert(db, 'theory', { ...r, entity_id: id, resolved_book_id: m(maps.book, r.resolved_book_id) }, thCols);
  }

  const pCols = columnsOf(db, 'event_participant');
  for (const r of rowsOf(dump, 'event_participant')) {
    const ev = m(maps.entity, r.event_id), en = m(maps.entity, r.entity_id);
    if (ev !== null && en !== null) insert(db, 'event_participant', { ...r, event_id: ev, entity_id: en }, pCols, ['id']);
  }
  const lCols = columnsOf(db, 'entity_link');
  for (const r of rowsOf(dump, 'entity_link')) {
    const from = m(maps.entity, r.from_entity_id), to = m(maps.entity, r.to_entity_id);
    if (from === null || to === null) continue;
    insert(db, 'entity_link', {
      ...r, from_entity_id: from, to_entity_id: to,
      start_event_id: m(maps.entity, r.start_event_id), end_event_id: m(maps.entity, r.end_event_id),
    }, lCols, ['id']);
  }
  const mCols = columnsOf(db, 'mention');
  for (const r of rowsOf(dump, 'mention')) {
    const s = m(maps.entity, r.source_entity_id), t = m(maps.entity, r.target_entity_id);
    if (s !== null && t !== null) insert(db, 'mention', { source_entity_id: s, target_entity_id: t }, mCols);
  }

  const qCols = columnsOf(db, 'quote');
  for (const r of rowsOf(dump, 'quote')) {
    const id = m(maps.entity, r.entity_id);
    if (id === null) continue;
    insert(db, 'quote', {
      ...r, entity_id: id, book_id: m(maps.book, r.book_id), speaker_entity_id: m(maps.entity, r.speaker_entity_id),
    }, qCols, ['id']);
  }

  const seriesIds = [...maps.series.values()];
  for (const sid of seriesIds) recomputeSeries(db, sid);
  return { mode: 'add', seriesIds };
}

/** Imports a JSON dump in one transaction; nothing changes if anything fails. */
export function importJson(db: SqlDb, raw: unknown, mode: ImportMode): ImportResult {
  const dump = validateDump(raw, currentVersion(db));
  return db.transaction(() => {
    const result = mode === 'replace' ? importReplace(db, dump) : importAdd(db, dump);
    // Exports from before v3 carry the old emoji; give their untouched built-in types the line icons too.
    if ((dump.schemaVersion ?? 0) < 3) db.exec(LINE_ICONS_SQL);
    // Exports from before v5 have no Theory type; give every series one, as the migration does.
    if ((dump.schemaVersion ?? 0) < 5) db.exec(THEORY_TYPE_SQL);
    return result;
  });
}
