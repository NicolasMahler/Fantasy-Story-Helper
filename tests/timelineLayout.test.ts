import { describe, it, expect } from 'vitest';
import {
  filterEvents, storyLayout, readingLayout, chartLayout, gapSize, formatSpan, NO_FILTERS,
} from '../src/lib/timelineLayout';
import { containingAge, type AgeInfo } from '../src/db/dates';
import type { TimelineEvent } from '../src/db/timeline';

const ages: AgeInfo[] = [
  { id: 1, name: 'First', start_year: 0, end_year: 999, direction: 'forward' },
  { id: 2, name: 'Second', start_year: 1000, end_year: null, direction: 'forward' },
  { id: 3, name: 'Before', start_year: -10, end_year: -500, direction: 'backward' },
];

let n = 0;
function ev(p: Partial<TimelineEvent> & { name: string }): TimelineEvent {
  return {
    id: ++n, mode: 'present', effectiveKey: null, manualOrder: 0, bookId: null, bookNumber: null, bookTitle: null,
    label: '', short: '', laneAgeId: null, toldBy: null, participants: [], ...p,
  };
}

describe('containingAge', () => {
  it('prefers the explicit age, then the age whose range holds the key', () => {
    expect(containingAge(5, 2, ages)).toBe(2);
    expect(containingAge(500, null, ages)).toBe(1);
    expect(containingAge(5000, null, ages)).toBe(2);
    expect(containingAge(-100, null, ages)).toBe(3);
    expect(containingAge(-5000, null, ages)).toBeNull();
    expect(containingAge(null, null, ages)).toBeNull();
  });
});

describe('gapSize / formatSpan', () => {
  it('grows logarithmically and is zero for no gap', () => {
    expect(gapSize(0)).toBe(0);
    expect(gapSize(1)).toBeGreaterThan(0);
    expect(gapSize(10)).toBeLessThan(gapSize(1000));
    expect(gapSize(100_000)).toBeLessThan(120);
  });
  it('formats spans exactly when small, rounded when large', () => {
    expect(formatSpan(1)).toBe('1 year');
    expect(formatSpan(7)).toBe('7 years');
    expect(formatSpan(1163)).toBe('~1,200 years');
    expect(formatSpan(89_990)).toBe('~90,000 years');
  });
});

describe('filterEvents', () => {
  const hero = { entityId: 100, name: 'Hero', icon: '', typeId: 7, typeKey: 'character', role: 'participant' };
  const city = { entityId: 200, name: 'City', icon: '', typeId: 8, typeKey: 'location', role: 'location' };
  const a = ev({ name: 'A', bookId: 1, participants: [hero, city] });
  const b = ev({ name: 'B', bookId: 2, participants: [city] });
  const c = ev({ name: 'C', bookId: 2, toldBy: { id: 100, name: 'Hero' } });
  const all = [a, b, c];
  it('passes everything with no filters', () => expect(filterEvents(all, NO_FILTERS)).toEqual(all));
  it('matches a character as participant or teller', () =>
    expect(filterEvents(all, { ...NO_FILTERS, entityIds: [100] }).map((e) => e.name)).toEqual(['A', 'C']));
  it('combines filters with AND', () => {
    expect(filterEvents(all, { ...NO_FILTERS, entityIds: [100, 200] }).map((e) => e.name)).toEqual(['A']);
    expect(filterEvents(all, { ...NO_FILTERS, typeId: 8, bookId: 2 }).map((e) => e.name)).toEqual(['B']);
  });
});

describe('storyLayout', () => {
  it('orders by position, splits lanes by age, inserts gaps, puts undated last', () => {
    const myth = ev({ name: 'Myth', effectiveKey: -100_000, short: 'In myth' });
    const old = ev({ name: 'Old', effectiveKey: 500, laneAgeId: 1, short: '500' });
    const b2 = ev({ name: 'Same year B', effectiveKey: 1163, laneAgeId: 2, short: '163', manualOrder: 1 });
    const b1 = ev({ name: 'Same year A', effectiveKey: 1163, laneAgeId: 2, short: '163' });
    const later = ev({ name: 'Later', effectiveKey: 1164, laneAgeId: 2, short: '164' });
    const undated = ev({ name: 'Whenever' });
    const out = storyLayout([later, undated, b2, myth, b1, old], ages);

    expect(out.lanes.map((l) => [l.ageId, l.label])).toEqual([[null, 'Unplaced'], [1, 'First'], [2, 'Second']]);
    const rows = out.lanes.flatMap((l) => l.rows).map((r) =>
      r.kind === 'event' ? `${r.event.name}@${r.when ?? ''}` : `gap:${r.label ?? ''}`);
    expect(rows).toEqual([
      'Myth@In myth', 'gap:~100,000 years', 'Old@500', 'gap:~660 years',
      'Same year A@163', 'Same year B@', 'gap:', 'Later@164',
    ]);
    expect(out.undated.map((e) => e.name)).toEqual(['Whenever']);
  });
});

describe('readingLayout', () => {
  const books = [{ id: 1, number: 1, title: 'One' }, { id: 2, number: 2, title: 'Two' }];
  it('groups by book in story order, keeps empty books, puts no-book last', () => {
    const x = ev({ name: 'X', bookId: 2, effectiveKey: 5 });
    const y = ev({ name: 'Y', bookId: 2, effectiveKey: 1 });
    const z = ev({ name: 'Z', effectiveKey: 3 });
    const out = readingLayout([x, y, z], books);
    expect(out.map((s) => [s.book?.title ?? 'none', s.events.map((e) => e.name)])).toEqual([
      ['One', []], ['Two', ['Y', 'X']], ['none', ['Z']],
    ]);
  });
});

describe('chartLayout', () => {
  const books = [{ id: 1, number: 1, title: 'One' }, { id: 2, number: 2, title: 'Two' }];
  const p1 = ev({ name: 'P1', bookId: 1, effectiveKey: 1163, short: '1163' });
  const p2 = ev({ name: 'P2', bookId: 2, effectiveKey: 1164, short: '1164' });
  const r1 = ev({ name: 'R1', bookId: 1, effectiveKey: -100_000, mode: 'recounted', short: 'Ancient' });
  const u = ev({ name: 'U', bookId: 1 });
  const out = chartLayout([p1, p2, r1, u], books, { width: 800, height: 400, left: 80, top: 20, bottom: 40 });
  const pt = (name: string) => out.points.find((p) => p.event.name === name)!;

  it('puts books in columns left to right and leaves undated out', () => {
    expect(out.columns.map((c) => c.book?.number)).toEqual([1, 2]);
    expect(pt('P1').x).toBeLessThan(pt('P2').x);
    expect(pt('R1').x).toBeGreaterThan(out.columns[0].x0);
    expect(pt('R1').x).toBeLessThan(out.columns[0].x1);
    expect(out.undatedCount).toBe(1);
  });

  it('maps later story time higher (smaller y), within the plot area', () => {
    expect(pt('P2').y).toBeLessThan(pt('P1').y);
    expect(pt('P1').y).toBeLessThan(pt('R1').y);
    for (const p of out.points) {
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(360);
    }
  });

  it('tethers recounted events to the ridge of their book', () => {
    expect(pt('P1').tether).toBeNull();
    expect(pt('R1').tether).toEqual({ x: pt('R1').x, y: pt('P1').y });
  });

  it('labels y ticks from event short labels', () => {
    expect(out.yTicks.map((t) => t.label)).toEqual(['Ancient', '1163', '1164']);
  });
});
