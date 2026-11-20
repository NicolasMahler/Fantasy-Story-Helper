import type { SqlDb } from './types';
import { containingAge, formatDate, yearInAge, type AgeInfo, type EventDate } from './dates';
import { loadCalendar, type EventMode } from './events';

export interface TimelineParticipant {
  entityId: number;
  name: string;
  icon: string;
  typeId: number;
  typeKey: string;
  role: string;
}

export interface TimelineEvent {
  id: number;
  name: string;
  mode: EventMode;
  effectiveKey: number | null;
  /** Position set by hand (sort_key_override) rather than computed from the date. */
  pinned: boolean;
  manualOrder: number;
  bookId: number | null;
  bookNumber: number | null;
  bookTitle: string | null;
  /** Full date label, e.g. "Year 12, Third Age". */
  label: string;
  /** Compact axis label: year within the lane's age, bucket label, or plain year. Empty when undated. */
  short: string;
  /** Age lane on the timeline (explicit or containing age), null = Unplaced. */
  laneAgeId: number | null;
  toldBy: { id: number; name: string } | null;
  participants: TimelineParticipant[];
}

export interface TimelineBook {
  id: number;
  number: number;
  title: string;
}

export interface TimelineData {
  events: TimelineEvent[];
  ages: AgeInfo[];
  books: TimelineBook[];
}

type Row = EventDate & {
  entity_id: number; name: string; mode: EventMode; sort_key: number | null; manual_order: number;
  book_id: number | null; b_number: number | null; b_title: string | null; teller_name: string | null;
  told_by_entity_id: number | null;
};

/** Everything the Timeline tab needs for one series, in one read. */
export function getTimeline(db: SqlDb, seriesId: number): TimelineData {
  const { ageList: ages, ages: ageMap, buckets } = loadCalendar(db, seriesId);
  const books = db.query<TimelineBook>('SELECT id, number, title FROM book WHERE series_id = ? ORDER BY number', [seriesId]);

  const rows = db.query<Row>(
    `SELECT ev.*, e.name, b.number AS b_number, b.title AS b_title, t.name AS teller_name
     FROM event ev JOIN entity e ON e.id = ev.entity_id
     LEFT JOIN book b ON b.id = ev.book_id LEFT JOIN entity t ON t.id = ev.told_by_entity_id
     WHERE e.series_id = ?`,
    [seriesId],
  );
  const names = new Map(rows.map((r) => [r.entity_id, r.name]));

  const parts = new Map<number, TimelineParticipant[]>();
  for (const p of db.query<TimelineParticipant & { eventId: number }>(
    `SELECT p.event_id AS eventId, p.entity_id AS entityId, e.name, t.icon, t.id AS typeId, t.key AS typeKey, p.role
     FROM event_participant p JOIN entity e ON e.id = p.entity_id JOIN entity_type t ON t.id = e.type_id
     JOIN entity ev ON ev.id = p.event_id
     WHERE ev.series_id = ? ORDER BY e.name COLLATE NOCASE, p.role`,
    [seriesId],
  )) {
    const { eventId, ...rest } = p;
    if (!parts.has(eventId)) parts.set(eventId, []);
    parts.get(eventId)!.push(rest);
  }

  const events = rows.map((r): TimelineEvent => {
    const key = r.sort_key_override ?? r.sort_key;
    const lane = containingAge(key, r.date_precision === 'year' || r.date_precision === 'age' ? r.age_id : null, ages);
    const laneAge = lane === null ? undefined : ageMap.get(lane);
    let short = '';
    if (key !== null) {
      if (r.date_precision === 'bucket' && r.sort_key_override === null) short = buckets.get(r.bucket!)?.label ?? '';
      else if (r.date_precision === 'age' && r.sort_key_override === null) short = 'approx.';
      else {
        const y = laneAge ? yearInAge(key, laneAge) : key;
        short = Number.isInteger(y) ? String(y) : y.toFixed(1);
      }
    }
    return {
      id: r.entity_id,
      name: r.name,
      mode: r.mode,
      effectiveKey: key,
      pinned: r.sort_key_override !== null,
      manualOrder: r.manual_order,
      bookId: r.book_id,
      bookNumber: r.b_number,
      bookTitle: r.b_title,
      label: formatDate(r, ageMap, buckets, names),
      short,
      laneAgeId: lane,
      toldBy: r.told_by_entity_id ? { id: r.told_by_entity_id, name: r.teller_name! } : null,
      participants: parts.get(r.entity_id) ?? [],
    };
  });
  return { events, ages, books };
}
