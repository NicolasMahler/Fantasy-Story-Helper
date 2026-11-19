import { describe, it, expect } from 'vitest';
import { parseRoute, href } from '../src/lib/route';

describe('parseRoute', () => {
  it('parses every screen', () => {
    expect(parseRoute('')).toEqual({ name: 'library' });
    expect(parseRoute('#/')).toEqual({ name: 'library' });
    expect(parseRoute('#/settings')).toEqual({ name: 'settings' });
    expect(parseRoute('#/s/4')).toEqual({ name: 'series', seriesId: 4, tab: 'entries' });
    expect(parseRoute('#/s/4/books')).toEqual({ name: 'series', seriesId: 4, tab: 'books' });
    expect(parseRoute('#/s/4/types')).toEqual({ name: 'series', seriesId: 4, tab: 'types' });
    expect(parseRoute('#/s/4/timeline')).toEqual({ name: 'series', seriesId: 4, tab: 'timeline' });
    expect(parseRoute('#/s/4/calendar')).toEqual({ name: 'series', seriesId: 4, tab: 'calendar' });
    expect(parseRoute('#/s/4/e/9')).toEqual({ name: 'entity', seriesId: 4, entityId: 9 });
    expect(parseRoute('#/s/4/new')).toEqual({ name: 'newEntity', seriesId: 4, typeId: null });
    expect(parseRoute('#/s/4/new/7')).toEqual({ name: 'newEntity', seriesId: 4, typeId: 7 });
  });

  it('falls back to not-found for junk', () => {
    expect(parseRoute('#/s/abc')).toEqual({ name: 'notFound' });
    expect(parseRoute('#/nope')).toEqual({ name: 'notFound' });
  });

  it('builds hrefs that round-trip', () => {
    for (const r of [
      { name: 'library' }, { name: 'settings' },
      { name: 'series', seriesId: 2, tab: 'books' },
      { name: 'entity', seriesId: 2, entityId: 5 },
      { name: 'newEntity', seriesId: 2, typeId: 3 },
    ] as const) {
      expect(parseRoute(href(r))).toEqual(r.name === 'series' ? r : { ...r });
    }
  });
});
