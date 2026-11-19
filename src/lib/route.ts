export type SeriesTab = 'entries' | 'timeline' | 'books' | 'types' | 'calendar';

export type Route =
  | { name: 'library' }
  | { name: 'settings' }
  | { name: 'series'; seriesId: number; tab: SeriesTab }
  | { name: 'entity'; seriesId: number; entityId: number }
  | { name: 'newEntity'; seriesId: number; typeId: number | null }
  | { name: 'notFound' };

const id = '(\\d+)';
const patterns: [RegExp, (m: RegExpMatchArray) => Route][] = [
  [/^$/, () => ({ name: 'library' })],
  [/^settings$/, () => ({ name: 'settings' })],
  [new RegExp(`^s/${id}(?:/(timeline|books|types|calendar))?$`), (m) => ({ name: 'series', seriesId: +m[1], tab: (m[2] as SeriesTab) ?? 'entries' })],
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
    case 'series': return r.tab === 'entries' ? `#/s/${r.seriesId}` : `#/s/${r.seriesId}/${r.tab}`;
    case 'entity': return `#/s/${r.seriesId}/e/${r.entityId}`;
    case 'newEntity': return `#/s/${r.seriesId}/new${r.typeId ? `/${r.typeId}` : ''}`;
  }
}
