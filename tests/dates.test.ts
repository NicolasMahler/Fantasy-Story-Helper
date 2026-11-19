import { describe, it, expect } from 'vitest';
import { computeSortKeys, wouldCreateCycle, formatDate, type EventDate, type AgeInfo } from '../src/db/dates';

const undated: EventDate = {
  date_precision: null, year: null, age_id: null, relative_to_event: null, offset_years: null, bucket: null,
  sort_key_override: null,
};
const ev = (p: Partial<EventDate>): EventDate => ({ ...undated, ...p });

const ages = new Map<number, AgeInfo>([
  [1, { id: 1, name: 'Third Age', start_year: 1000, end_year: null, direction: 'forward' }],
  [2, { id: 2, name: 'Before Count', start_year: 0, end_year: -500, direction: 'backward' }],
]);
const buckets = new Map([
  ['mythic', { label: 'In myth', sort_key: -1_000_000 }],
  ['present', { label: 'Present day', sort_key: 0 }],
]);

describe('computeSortKeys', () => {
  it('applies each precision rule', () => {
    const keys = computeSortKeys(
      new Map([
        [10, ev({ date_precision: 'year', year: 312, age_id: 1 })],
        [11, ev({ date_precision: 'year', year: 50, age_id: 2 })],
        [12, ev({ date_precision: 'year', year: 7 })],
        [13, ev({ date_precision: 'age', age_id: 1 })],
        [14, ev({ date_precision: 'relative', relative_to_event: 10, offset_years: 5 })],
        [15, ev({ date_precision: 'relative', relative_to_event: 10, offset_years: -12 })],
        [16, ev({ date_precision: 'bucket', bucket: 'mythic' })],
        [17, undated],
      ]),
      ages,
      buckets,
    );
    expect(Object.fromEntries(keys)).toEqual({
      10: 1312, 11: -50, 12: 7, 13: 1000, 14: 1317, 15: 1300, 16: -1_000_000, 17: null,
    });
  });

  it('chains relatives through the target effective key (override wins)', () => {
    const keys = computeSortKeys(
      new Map([
        [1, ev({ date_precision: 'year', year: 5, sort_key_override: 100 })],
        [2, ev({ date_precision: 'relative', relative_to_event: 1, offset_years: 1 })],
        [3, ev({ date_precision: 'relative', relative_to_event: 2, offset_years: 1 })],
      ]),
      ages,
      buckets,
    );
    expect(Object.fromEntries(keys)).toEqual({ 1: 5, 2: 101, 3: 102 });
  });

  it('gives null to events with missing or undated anchors, unknown ages/buckets, and cycles', () => {
    const keys = computeSortKeys(
      new Map([
        [1, undated],
        [2, ev({ date_precision: 'relative', relative_to_event: 1, offset_years: 3 })],
        [3, ev({ date_precision: 'relative', relative_to_event: 99, offset_years: 3 })],
        [4, ev({ date_precision: 'age', age_id: 42 })],
        [5, ev({ date_precision: 'bucket', bucket: 'nope' })],
        [6, ev({ date_precision: 'relative', relative_to_event: 7, offset_years: 1 })],
        [7, ev({ date_precision: 'relative', relative_to_event: 6, offset_years: 1 })],
      ]),
      ages,
      buckets,
    );
    expect([...keys.values()]).toEqual([null, null, null, null, null, null, null]);
  });
});

describe('wouldCreateCycle', () => {
  const events = new Map([
    [1, ev({ date_precision: 'relative', relative_to_event: 2 })],
    [2, ev({ date_precision: 'relative', relative_to_event: 3 })],
    [3, ev({ date_precision: 'year', year: 1 })],
  ]);
  it('detects a loop back to the edited event', () => {
    expect(wouldCreateCycle(events, 3, 1)).toBe(true);
    expect(wouldCreateCycle(events, 3, 3)).toBe(true);
  });
  it('allows non-looping targets', () => {
    expect(wouldCreateCycle(events, 1, 3)).toBe(false);
    expect(wouldCreateCycle(events, 4, 1)).toBe(false);
  });
});

describe('formatDate', () => {
  const names = new Map([[10, 'The Fall']]);
  const f = (p: Partial<EventDate>) => formatDate(ev(p), ages, buckets, names);
  it('formats every precision', () => {
    expect(f({ date_precision: 'year', year: 312, age_id: 1 })).toBe('Year 312, Third Age');
    expect(f({ date_precision: 'year', year: 312 })).toBe('Year 312');
    expect(f({ date_precision: 'age', age_id: 1 })).toBe('Third Age (approx.)');
    expect(f({ date_precision: 'relative', relative_to_event: 10, offset_years: 5 })).toBe('5 years after The Fall');
    expect(f({ date_precision: 'relative', relative_to_event: 10, offset_years: -1 })).toBe('1 year before The Fall');
    expect(f({ date_precision: 'relative', relative_to_event: 10, offset_years: 0 })).toBe('Same year as The Fall');
    expect(f({ date_precision: 'bucket', bucket: 'mythic' })).toBe('In myth');
    expect(f({})).toBe('Undated');
    expect(f({ date_precision: 'year', year: 1, sort_key_override: 9 })).toBe('Year 1 (pinned)');
  });
});
