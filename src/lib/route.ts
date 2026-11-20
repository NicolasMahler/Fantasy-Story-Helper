export type SeriesTab = 'entries' | 'timeline' | 'graph' | 'books' | 'types' | 'calendar';

export type Route =
  | { name: 'library' }
  | { name: 'settings' }
  /** `focus`: on the timeline, an event to scroll to and open. */
  | { name: 'series'; seriesId: number; tab: SeriesTab; focus?: number }
  | { name: 'entity'; seriesId: number; entityId: number }
  | { name: 'newEntity'; seriesId: number; typeId: number | null }
  | { name: 'notFound' };

const id = '(\\d+)';
const patterns: [RegExp, (m: RegExpMatchArray) => Route][] = [
  [/^$/, () => ({ name: 'library' })],
  [/^settings$/, () => ({ name: 'settings' })],
  [new RegExp(`^s/${id}(?:/(timeline|graph|books|types|calendar))?$`), (m) => ({ name: 'series', seriesId: +m[1], tab: (m[2] as SeriesTab) ?? 'entries' })],
  [new RegExp(`^s/${id}/timeline/e/${id}$`), (m) => ({ name: 'series', seriesId: +m[1], tab: 'timeline', focus: +m[2] })],
  [new RegExp(`^s/${id}/e/${id}$`), (m) => ({ name: 'entity', seriesId: +m[1], entityId: +m[2] })],
  [new RegExp(`^s/${id}/new(?:/${id})?$`), (m) => ({ name: 'newEntity', seriesId: +m[1], typeId: m[2] ? +m[2] : null })],
];

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#?\/?/, '').replace(/\/$/, '');
  for (const [re, make] of patterns) {
    const m = path.match(re);
    if (m) return make(m);
  }
  return { name: 'notFound' };
}

export function href(r: Exclude<Route, { name: 'notFound' }>): string {
  switch (r.name) {
    case 'library': return '#/';
    case 'settings': return '#/settings';
    case 'series':
      if (r.tab === 'timeline' && r.focus !== undefined) return `#/s/${r.seriesId}/timeline/e/${r.focus}`;
      return r.tab === 'entries' ? `#/s/${r.seriesId}` : `#/s/${r.seriesId}/${r.tab}`;
    case 'entity': return `#/s/${r.seriesId}/e/${r.entityId}`;
    case 'newEntity': return `#/s/${r.seriesId}/new${r.typeId ? `/${r.typeId}` : ''}`;
  }
}
