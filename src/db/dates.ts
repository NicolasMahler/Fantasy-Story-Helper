/** Pure date logic: sort keys on the master axis (years), cycle checks, and display labels. */

import { plural } from '../lib/text';

export type DatePrecision = 'year' | 'age' | 'relative' | 'bucket';
export const DATE_PRECISIONS: { value: DatePrecision | null; label: string }[] = [
  { value: null, label: 'Undated' },
  { value: 'year', label: 'Year' },
  { value: 'age', label: 'Sometime in an age' },
  { value: 'relative', label: 'Relative to another event' },
  { value: 'bucket', label: 'Vague (long ago, …)' },
];

export interface EventDate {
  date_precision: DatePrecision | null;
  year: number | null;
  age_id: number | null;
  relative_to_event: number | null;
  offset_years: number | null;
  bucket: string | null;
  sort_key_override: number | null;
}

export interface AgeInfo {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  direction: 'forward' | 'backward';
}

export interface BucketInfo {
  label: string;
  sort_key: number;
}

/**
 * Raw sort key for every event (before override). Relative dates use the target's effective key
 * (override ?? raw). Missing anchors, unknown ages/buckets and cycles yield null.
 */
export function computeSortKeys(
  events: Map<number, EventDate>,
  ages: Map<number, AgeInfo>,
  buckets: Map<string, BucketInfo>,
): Map<number, number | null> {
  const raw = new Map<number, number | null>();
  const visiting = new Set<number>();

  const effective = (id: number): number | null => {
    const e = events.get(id);
    if (!e) return null;
    return e.sort_key_override ?? rawKey(id);
  };

  const rawKey = (id: number): number | null => {
    if (raw.has(id)) return raw.get(id)!;
    if (visiting.has(id)) return null; // cycle
    const e = events.get(id)!;
    visiting.add(id);
    let key: number | null = null;
    switch (e.date_precision) {
      case 'year': {
        if (e.year === null) break;
        if (e.age_id === null) key = e.year;
        else {
          const age = ages.get(e.age_id);
          if (age) key = age.direction === 'backward' ? age.start_year - e.year : age.start_year + e.year;
        }
        break;
      }
      case 'age':
        key = e.age_id === null ? null : (ages.get(e.age_id)?.start_year ?? null);
        break;
      case 'relative': {
        const base = e.relative_to_event === null ? null : effective(e.relative_to_event);
        key = base === null ? null : base + (e.offset_years ?? 0);
        break;
      }
      case 'bucket':
        key = e.bucket === null ? null : (buckets.get(e.bucket)?.sort_key ?? null);
        break;
    }
    visiting.delete(id);
    raw.set(id, key);
    return key;
  };

  const out = new Map<number, number | null>();
  for (const id of events.keys()) out.set(id, rawKey(id));
  return out;
}

/** True if dating `id` relative to `target` would create a loop of relative dates. */
export function wouldCreateCycle(events: Map<number, EventDate>, id: number, target: number): boolean {
  const seen = new Set<number>();
  let cur: number | null = target;
  while (cur !== null) {
    if (cur === id) return true;
    if (seen.has(cur)) return false; // an existing loop that doesn't involve `id`
    seen.add(cur);
    const e = events.get(cur);
    if (!e || e.date_precision !== 'relative') return false;
    cur = e.relative_to_event;
  }
  return false;
}

/** Human label: "Year 312, Third Age", "5 years after X", "Long ago", "Undated"… */
export function formatDate(
  e: EventDate,
  ages: Map<number, AgeInfo>,
  buckets: Map<string, BucketInfo>,
  eventNames: Map<number, string>,
): string {
  const ageName = (id: number | null) => (id === null ? null : (ages.get(id)?.name ?? 'an unknown age'));
  let s: string;
  switch (e.date_precision) {
    case 'year': {
      const age = ageName(e.age_id);
      s = `Year ${e.year}${age ? `, ${age}` : ''}`;
      break;
    }
    case 'age':
      s = `${ageName(e.age_id)} (approx.)`;
      break;
    case 'relative': {
      const name = (e.relative_to_event !== null && eventNames.get(e.relative_to_event)) || 'an unknown event';
      const n = e.offset_years ?? 0;
      s = n === 0 ? `Same year as ${name}` : `${plural(Math.abs(n), 'year')} ${n > 0 ? 'after' : 'before'} ${name}`;
      break;
    }
    case 'bucket':
      s = (e.bucket !== null && buckets.get(e.bucket)?.label) || 'Vague date';
      break;
    default:
      s = 'Undated';
  }
  return e.sort_key_override !== null ? `${s} (pinned)` : s;
}

/**
 * The age an event belongs to on the timeline: its explicit age, else the first age (by start)
 * whose range contains the position. Backward ages run from start down to end.
 */
export function containingAge(key: number | null, explicitAgeId: number | null, ages: AgeInfo[]): number | null {
  if (explicitAgeId !== null) return explicitAgeId;
  if (key === null) return null;
  const sorted = [...ages].sort((a, b) => a.start_year - b.start_year);
  for (const a of sorted) {
    const inside = a.direction === 'forward'
      ? key >= a.start_year && (a.end_year === null || key <= a.end_year)
      : key <= a.start_year && (a.end_year === null || key >= a.end_year);
    if (inside) return a.id;
  }
  return null;
}

/** Year within an age for a position on the master axis. */
export function yearInAge(key: number, age: AgeInfo): number {
  return age.direction === 'backward' ? age.start_year - key : key - age.start_year;
}
