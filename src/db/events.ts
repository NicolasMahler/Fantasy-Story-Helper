import type { SqlDb } from './types';
import { bookRef, type BookRef } from './books';
import { bookInSeries, extensionSeries, inSeries, insertId, seriesOf } from './sql';
import {
  computeSortKeys, wouldCreateCycle, formatDate,
  type AgeInfo, type BucketInfo, type DatePrecision, type EventDate,
} from './dates';

export type EventMode = 'present' | 'recounted';

export interface EventInput {
  mode: EventMode;
  bookId: number | null;
  toldById: number | null;
  datePrecision: DatePrecision | null;
  year: number | null;
  ageId: number | null;
  relativeTo: number | null;
  offsetYears: number | null;
  bucket: string | null;
  sortKeyOverride: number | null;
  manualOrder: number;
}

export interface Participant {
  /** event_participant row id */
  id: number;
  entityId: number;
  name: string;
  icon: string;
  color: string;
  typeName: string;
  typeKey: string;
  role: string;
}

export interface EventDetail {
  entityId: number;
  mode: EventMode;
  datePrecision: DatePrecision | null;
  year: number | null;
  ageId: number | null;
  relativeTo: number | null;
  offsetYears: number | null;
  bucket: string | null;
  sortKey: number | null;
  sortKeyOverride: number | null;
  effectiveKey: number | null;
  manualOrder: number;
  book: BookRef | null;
  toldBy: { id: number; name: string; icon: string } | null;
  relativeTarget: { id: number; name: string } | null;
  label: string;
  participants: Participant[];
}

export interface EntityEvent {
  eventId: number;
  name: string;
  mode: EventMode;
  role: string;
  label: string;
  effectiveKey: number | null;
  bookNumber: number | null;
}

export const ROLE_SUGGESTIONS = ['participant', 'location', 'leader', 'witness', 'victim', 'cause', 'mentioned'];

type EventRow = EventDate & { entity_id: number; sort_key: number | null; manual_order: number; mode: EventMode };

function seriesEvents(db: SqlDb, seriesId: number): Map<number, EventRow> {
  const rows = db.query<EventRow>(
    `SELECT ev.* FROM event ev JOIN entity e ON e.id = ev.entity_id WHERE e.series_id = ?`,
    [seriesId],
  );
  return new Map(rows.map((r) => [r.entity_id, r]));
}

/** A series' ages (by start, plus by id) and vague-date buckets (by key). */
export function loadCalendar(db: SqlDb, seriesId: number) {
  const ageList = db.query<AgeInfo>(
    'SELECT id, name, start_year, end_year, direction FROM age WHERE series_id = ? ORDER BY start_year, id',
    [seriesId],
  );
  const buckets = new Map(
    db.query<BucketInfo & { bucket: string }>('SELECT bucket, label, sort_key FROM bucket_default WHERE series_id = ?', [seriesId])
      .map((b) => [b.bucket, b]),
  );
  return { ageList, ages: new Map(ageList.map((a) => [a.id, a])), buckets };
}

/** Returns a function that labels any event row of the series. */
function labeller(db: SqlDb, seriesId: number) {
  const { ages, buckets } = loadCalendar(db, seriesId);
  const names = new Map(
    db.query<{ id: number; name: string }>(
      `SELECT e.id, e.name FROM entity e JOIN event ev ON ev.entity_id = e.id WHERE e.series_id = ?`,
      [seriesId],
    ).map((r) => [r.id, r.name]),
  );
  return (e: EventDate) => formatDate(e, ages, buckets, names);
}

/** Recomputes sort_key for every event in the series (rule 4). */
export function recomputeSeries(db: SqlDb, seriesId: number): void {
  const events = seriesEvents(db, seriesId);
  const { ages, buckets } = loadCalendar(db, seriesId);
  const keys = computeSortKeys(events, ages, buckets);
  for (const [id, key] of keys) {
    if (events.get(id)!.sort_key !== key) db.exec('UPDATE event SET sort_key = ? WHERE entity_id = ?', [key, id]);
  }
}

/**
 * Clears relative dates (in one series, or everywhere) before deleting events in bulk: deleting an anchor
 * would SET NULL relative_to_event and trip the event CHECK.
 */
export function detachRelativeDates(db: SqlDb, seriesId?: number): void {
  const scope = seriesId === undefined ? '' : ' AND entity_id IN (SELECT id FROM entity WHERE series_id = ?)';
  db.exec(
    `UPDATE event SET date_precision = NULL, relative_to_event = NULL, offset_years = NULL WHERE relative_to_event IS NOT NULL${scope}`,
    seriesId === undefined ? [] : [seriesId],
  );
}

/**
 * Before an event disappears (deleted or retyped), events dated relative to it are frozen at their
 * current position as a plain year (or made undated if they had no position).
 */
export function freezeDependents(db: SqlDb, anchorId: number): void {
  for (const d of db.query<{ entity_id: number; sort_key: number | null }>(
    'SELECT entity_id, sort_key FROM event WHERE relative_to_event = ?',
    [anchorId],
  )) {
    if (d.sort_key === null) {
      db.exec(`UPDATE event SET date_precision = NULL, relative_to_event = NULL, offset_years = NULL WHERE entity_id = ?`, [d.entity_id]);
    } else {
      db.exec(
        `UPDATE event SET date_precision = 'year', year = ?, age_id = NULL, relative_to_event = NULL, offset_years = NULL
         WHERE entity_id = ?`,
        [Math.round(d.sort_key), d.entity_id],
      );
    }
  }
}

function eventSeries(db: SqlDb, id: number): number {
  const s = extensionSeries(db, 'event', id);
  if (s === undefined) throw new Error('That entry is not an event.');
  return s;
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function saveEvent(db: SqlDb, id: number, input: EventInput): void {
  db.transaction(() => {
    const seriesId = eventSeries(db, id);
    const d: EventDate = {
      date_precision: input.datePrecision, year: null, age_id: null, relative_to_event: null,
      offset_years: null, bucket: null, sort_key_override: null,
    };

    switch (input.datePrecision) {
      case 'year':
        if (!isInt(input.year)) throw new Error('Enter a year (a whole number).');
        d.year = input.year;
        if (input.ageId !== null) {
          if (!inSeries(db, 'age', input.ageId, seriesId)) throw new Error('That age does not belong to this series.');
          d.age_id = input.ageId;
        }
        break;
      case 'age':
        if (input.ageId === null || !inSeries(db, 'age', input.ageId, seriesId)) throw new Error('Choose an age.');
        d.age_id = input.ageId;
        break;
      case 'relative': {
        if (input.relativeTo === null) throw new Error('Choose which event this is relative to.');
        const events = seriesEvents(db, seriesId);
        if (!events.has(input.relativeTo)) throw new Error('The relative date must point to an event in this series.');
        if (wouldCreateCycle(events, id, input.relativeTo)) {
          throw new Error('That would make a loop of relative dates (this event would end up relative to itself).');
        }
        const offset = input.offsetYears ?? 0;
        if (!isInt(offset)) throw new Error('The number of years must be a whole number.');
        d.relative_to_event = input.relativeTo;
        d.offset_years = offset;
        break;
      }
      case 'bucket': {
        const ok = input.bucket !== null
          && db.query('SELECT 1 FROM bucket_default WHERE series_id = ? AND bucket = ?', [seriesId, input.bucket]).length > 0;
        if (!ok) throw new Error('Choose a vague date.');
        d.bucket = input.bucket;
        break;
      }
      case null:
        break;
      default:
        throw new Error(`Unknown date precision "${input.datePrecision}".`);
    }

    if (input.sortKeyOverride !== null) {
      if (!Number.isFinite(input.sortKeyOverride)) throw new Error('The pinned position must be a number.');
      d.sort_key_override = input.sortKeyOverride;
    }
    if (!isInt(input.manualOrder)) throw new Error('The tiebreak order must be a whole number.');
    if (input.mode !== 'present' && input.mode !== 'recounted') throw new Error('Unknown mode.');
    bookInSeries(db, seriesId, input.bookId);
    const toldBy = input.mode === 'recounted' ? input.toldById : null;
    if (toldBy !== null && !inSeries(db, 'entity', toldBy, seriesId)) throw new Error('The teller must be an entry in this series.');

    db.exec(
      `UPDATE event SET mode = ?, book_id = ?, told_by_entity_id = ?, date_precision = ?, year = ?, age_id = ?,
              relative_to_event = ?, offset_years = ?, bucket = ?, sort_key_override = ?, manual_order = ?
       WHERE entity_id = ?`,
      [input.mode, input.bookId, toldBy, d.date_precision, d.year, d.age_id, d.relative_to_event, d.offset_years,
        d.bucket, d.sort_key_override, input.manualOrder, id],
    );
    db.exec(`UPDATE entity SET updated_at = datetime('now') WHERE id = ?`, [id]);
    recomputeSeries(db, seriesId);
  });
}

export function getEventDetail(db: SqlDb, id: number): EventDetail | null {
  const [r] = db.query<EventRow & {
    series_id: number; book_id: number | null; b_number: number | null; b_title: string | null;
    told_by_entity_id: number | null; t_name: string | null; t_icon: string | null; rel_name: string | null;
  }>(
    `SELECT ev.*, e.series_id, b.number AS b_number, b.title AS b_title,
            t.name AS t_name, tt.icon AS t_icon, rel.name AS rel_name
     FROM event ev JOIN entity e ON e.id = ev.entity_id
     LEFT JOIN book b ON b.id = ev.book_id
     LEFT JOIN entity t ON t.id = ev.told_by_entity_id LEFT JOIN entity_type tt ON tt.id = t.type_id
     LEFT JOIN entity rel ON rel.id = ev.relative_to_event
     WHERE ev.entity_id = ?`,
    [id],
  );
  if (!r) return null;
  const participants = db.query<Participant>(
    `SELECT p.id, p.entity_id AS entityId, e.name, t.icon, t.color, t.name AS typeName, t.key AS typeKey, p.role
     FROM event_participant p JOIN entity e ON e.id = p.entity_id JOIN entity_type t ON t.id = e.type_id
     WHERE p.event_id = ? ORDER BY e.name COLLATE NOCASE, p.role`,
    [id],
  );
  return {
    entityId: id,
    mode: r.mode,
    datePrecision: r.date_precision,
    year: r.year,
    ageId: r.age_id,
    relativeTo: r.relative_to_event,
    offsetYears: r.offset_years,
    bucket: r.bucket,
    sortKey: r.sort_key,
    sortKeyOverride: r.sort_key_override,
    effectiveKey: r.sort_key_override ?? r.sort_key,
    manualOrder: r.manual_order,
    book: bookRef(r.book_id, r.b_number, r.b_title),
    toldBy: r.told_by_entity_id ? { id: r.told_by_entity_id, name: r.t_name!, icon: r.t_icon ?? '' } : null,
    relativeTarget: r.relative_to_event ? { id: r.relative_to_event, name: r.rel_name! } : null,
    label: labeller(db, r.series_id)(r),
    participants,
  };
}

export function addParticipant(db: SqlDb, eventId: number, entityId: number, role?: string): number {
  return db.transaction(() => {
    const seriesId = eventSeries(db, eventId);
    if (entityId === eventId) throw new Error('An event cannot take part in itself.');
    const [ent] = db.query<{ series_id: number; key: string; name: string }>(
      'SELECT e.series_id, t.key, e.name FROM entity e JOIN entity_type t ON t.id = e.type_id WHERE e.id = ?',
      [entityId],
    );
    if (!ent || ent.series_id !== seriesId) throw new Error('That entry is not in this series.');
    const r = (role ?? '').trim() || (ent.key === 'location' ? 'location' : 'participant');
    if (db.query('SELECT 1 FROM event_participant WHERE event_id = ? AND entity_id = ? AND role = ?', [eventId, entityId, r]).length) {
      throw new Error(`${ent.name} is already listed as ${r}.`);
    }
    db.exec('INSERT INTO event_participant (event_id, entity_id, role) VALUES (?, ?, ?)', [eventId, entityId, r]);
    return insertId(db);
  });
}

export function updateParticipantRole(db: SqlDb, participantId: number, role: string): void {
  const r = role.trim();
  if (!r) throw new Error('Role is required.');
  db.transaction(() => {
    const [p] = db.query<{ event_id: number; entity_id: number; name: string }>(
      'SELECT p.event_id, p.entity_id, e.name FROM event_participant p JOIN entity e ON e.id = p.entity_id WHERE p.id = ?',
      [participantId],
    );
    if (!p) throw new Error('That participant no longer exists.');
    const dup = db.query(
      'SELECT 1 FROM event_participant WHERE event_id = ? AND entity_id = ? AND role = ? AND id <> ?',
      [p.event_id, p.entity_id, r, participantId],
    ).length;
    if (dup) throw new Error(`${p.name} is already listed as ${r}.`);
    db.exec('UPDATE event_participant SET role = ? WHERE id = ?', [r, participantId]);
  });
}

export function removeParticipant(db: SqlDb, participantId: number): void {
  db.exec('DELETE FROM event_participant WHERE id = ?', [participantId]);
}

/** Events an entry takes part in, in story order (undated last). */
export function eventsForEntity(db: SqlDb, entityId: number): EntityEvent[] {
  const seriesId = seriesOf(db, 'entity', entityId);
  if (seriesId === undefined) return [];
  const label = labeller(db, seriesId);
  return db
    .query<EventRow & { name: string; role: string; b_number: number | null }>(
      `SELECT * FROM (
         SELECT ev.*, e.name, p.role, b.number AS b_number
         FROM event_participant p JOIN event ev ON ev.entity_id = p.event_id JOIN entity e ON e.id = ev.entity_id
         LEFT JOIN book b ON b.id = ev.book_id
         WHERE p.entity_id = ?
         UNION ALL
         SELECT ev.*, e.name, 'told by' AS role, b.number AS b_number
         FROM event ev JOIN entity e ON e.id = ev.entity_id LEFT JOIN book b ON b.id = ev.book_id
         WHERE ev.told_by_entity_id = ?
       )
       ORDER BY COALESCE(sort_key_override, sort_key) IS NULL, COALESCE(sort_key_override, sort_key),
                manual_order, name COLLATE NOCASE`,
      [entityId, entityId],
    )
    .map((r) => ({
      eventId: r.entity_id,
      name: r.name,
      mode: r.mode,
      role: r.role,
      label: label(r),
      effectiveKey: r.sort_key_override ?? r.sort_key,
      bookNumber: r.b_number,
    }));
}
