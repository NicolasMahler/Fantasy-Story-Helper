/** Pure layout for the Timeline tab: filtering, story/reading grouping, the story × reading chart. */
import type { AgeInfo } from '../db/dates';
import type { TimelineBook, TimelineEvent } from '../db/timeline';

export interface Filters {
  /** Entries (characters, locations…) that must each take part in or tell the event. */
  entityIds: number[];
  /** Some participant must be of this type. */
  typeId: number | null;
  bookId: number | null;
}
export const NO_FILTERS: Filters = { entityIds: [], typeId: null, bookId: null };

export function filterEvents(events: TimelineEvent[], f: Filters): TimelineEvent[] {
  return events.filter((e) =>
    f.entityIds.every((id) => e.toldBy?.id === id || e.participants.some((p) => p.entityId === id))
    && (f.typeId === null || e.participants.some((p) => p.typeId === f.typeId))
    && (f.bookId === null || e.bookId === f.bookId));
}

/** Story order: position (undated last), then tiebreak, then name. */
export function storyCompare(a: TimelineEvent, b: TimelineEvent): number {
  if (a.effectiveKey === null || b.effectiveKey === null) {
    if (a.effectiveKey !== b.effectiveKey) return a.effectiveKey === null ? 1 : -1;
  } else if (a.effectiveKey !== b.effectiveKey) return a.effectiveKey - b.effectiveKey;
  return a.manualOrder - b.manualOrder || a.name.localeCompare(b.name);
}

/** Pixels of space for a gap of `years`: logarithmic, so deep time compresses. */
export function gapSize(years: number): number {
  if (years <= 0) return 0;
  return Math.round(6 + 16 * Math.log10(1 + years));
}

/** "1 year", "7 years", "~1,200 years". */
export function formatSpan(years: number): string {
  const y = Math.abs(years);
  if (y < 10) {
    const r = Math.round(y * 10) / 10;
    return `${r} ${r === 1 ? 'year' : 'years'}`;
  }
  return `~${Number(y.toPrecision(2)).toLocaleString('en-US')} years`;
}

export type StoryRow =
  | { kind: 'event'; event: TimelineEvent; when: string | null }
  | { kind: 'gap'; years: number; size: number; label: string | null };

export interface Lane {
  ageId: number | null;
  label: string;
  rows: StoryRow[];
}

/** Vertical story-order layout: consecutive runs of the same age become lanes; gaps between distinct positions. */
export function storyLayout(events: TimelineEvent[], ages: AgeInfo[]): { lanes: Lane[]; undated: TimelineEvent[] } {
  const ageName = new Map(ages.map((a) => [a.id, a.name]));
  const sorted = [...events].sort(storyCompare);
  const dated = sorted.filter((e) => e.effectiveKey !== null);
  const lanes: Lane[] = [];
  let prevKey: number | null = null;
  for (const e of dated) {
    const key = e.effectiveKey!;
    const sameKey = prevKey !== null && key === prevKey;
    if (prevKey !== null && !sameKey) {
      const years = key - prevKey;
      lanes.at(-1)!.rows.push({ kind: 'gap', years, size: gapSize(years), label: years >= 10 ? formatSpan(years) : null });
    }
    if (!lanes.length || lanes.at(-1)!.ageId !== e.laneAgeId) {
      lanes.push({ ageId: e.laneAgeId, label: e.laneAgeId === null ? 'Unplaced' : (ageName.get(e.laneAgeId) ?? 'Age'), rows: [] });
    }
    lanes.at(-1)!.rows.push({ kind: 'event', event: e, when: sameKey ? null : e.short });
    prevKey = key;
  }
  return { lanes, undated: sorted.filter((e) => e.effectiveKey === null) };
}

export interface ReadingSection {
  book: TimelineBook | null;
  events: TimelineEvent[];
}

/** Reading order: one section per book (all books, even empty), story order inside; no-book last if any. */
export function readingLayout(events: TimelineEvent[], books: TimelineBook[]): ReadingSection[] {
  const sorted = [...events].sort(storyCompare);
  const sections: ReadingSection[] = books.map((b) => ({ book: b, events: sorted.filter((e) => e.bookId === b.id) }));
  const loose = sorted.filter((e) => e.bookId === null || !books.some((b) => b.id === e.bookId));
  if (loose.length) sections.push({ book: null, events: loose });
  return sections;
}

export interface ChartPoint {
  event: TimelineEvent;
  x: number;
  y: number;
  /** For recounted events: where on the ridge it is told. */
  tether: { x: number; y: number } | null;
}

export interface ChartLayout {
  points: ChartPoint[];
  columns: { book: TimelineBook | null; x0: number; x1: number }[];
  yTicks: { y: number; label: string }[];
  /** Ridge line through present events, left to right. */
  ridge: { x: number; y: number }[];
  undatedCount: number;
}

export interface ChartBox {
  width: number;
  height: number;
  left: number;
  top: number;
  bottom: number;
}

/** Story time (y, log-compressed, past at bottom) × reading order (x, book columns). */
export function chartLayout(events: TimelineEvent[], books: TimelineBook[], box: ChartBox): ChartLayout {
  const dated = events.filter((e) => e.effectiveKey !== null);
  const undatedCount = events.length - dated.length;
  const sections = readingLayout(dated, books).filter((s) => s.book !== null || s.events.length);
  const colW = (box.width - box.left) / Math.max(1, sections.length);
  const columns = sections.map((s, i) => ({ book: s.book, x0: box.left + i * colW, x1: box.left + (i + 1) * colW }));

  // y: cumulative log gaps over distinct keys, plus a fixed step so close years don't collapse together.
  const keys = [...new Set(dated.map((e) => e.effectiveKey!))].sort((a, b) => a - b);
  const pos = new Map<number, number>();
  let acc = 0;
  keys.forEach((k, i) => {
    if (i > 0) acc += 24 + gapSize(k - keys[i - 1]);
    pos.set(k, acc);
  });
  const plotTop = box.top;
  const plotBottom = box.height - box.bottom;
  const yOf = (k: number) =>
    acc === 0 ? (plotTop + plotBottom) / 2 : plotBottom - (pos.get(k)! / acc) * (plotBottom - plotTop);

  const points: ChartPoint[] = [];
  const ridge: { x: number; y: number }[] = [];
  sections.forEach((s, i) => {
    const { x0, x1 } = columns[i];
    const step = (x1 - x0) / (s.events.length + 1);
    const placed = s.events.map((e, j) => ({ event: e, x: x0 + step * (j + 1), y: yOf(e.effectiveKey!), tether: null as ChartPoint['tether'] }));
    const present = placed.filter((p) => p.event.mode === 'present');
    const ridgeY = present.length ? present.reduce((sum, p) => sum + p.y, 0) / present.length : plotTop;
    for (const p of placed) if (p.event.mode === 'recounted') p.tether = { x: p.x, y: ridgeY };
    ridge.push(...present.map((p) => ({ x: p.x, y: p.y })));
    points.push(...placed);
  });

  // Ticks: one per distinct key, thinned to at most ~10, labelled by the first event's short label.
  const every = Math.max(1, Math.ceil(keys.length / 10));
  const yTicks = keys
    .filter((_, i) => i % every === 0)
    .map((k) => ({ y: yOf(k), label: dated.find((e) => e.effectiveKey === k)!.short }));

  return { points, columns, yTicks, ridge, undatedCount };
}
