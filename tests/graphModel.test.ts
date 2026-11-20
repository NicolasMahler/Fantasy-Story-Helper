import { describe, it, expect } from 'vitest';
import { buildGraph, edgeKey, type GraphFilters } from '../src/lib/graphModel';
import type { GraphData } from '../src/db/graph';
import type { TimelineEvent } from '../src/db/timeline';

// Types: 1 character, 2 location, 3 event, 4 item
const node = (id: number, name: string, typeId: number) => ({
  id, name, typeId, typeKey: ['', 'character', 'location', 'event', 'item'][typeId], icon: '', color: '#000',
});
const event = (id: number, name: string, participants: number[], bookId = 1): TimelineEvent => ({
  id, name, mode: 'present', effectiveKey: id, pinned: false, manualOrder: 0, bookId, bookNumber: bookId, bookTitle: null,
  label: '', short: '', laneAgeId: null, toldBy: null,
  participants: participants.map((p) => ({ entityId: p, name: '', icon: '', typeId: 0, typeKey: '', role: 'participant' })),
});

const data: GraphData = {
  types: [],
  books: [],
  nodes: [
    node(1, 'Kalam', 1), node(2, 'Ben', 1), node(3, 'Rake', 1), node(4, 'Pale', 2),
    node(5, 'Lonely', 1), node(6, 'Sword', 4),
    node(10, 'Siege', 3), node(11, 'Fete', 3),
  ],
  events: [event(10, 'Siege', [1, 2, 3, 4], 1), event(11, 'Fete', [1, 3], 2)],
  links: [
    { id: 100, from: 2, to: 1, kind: 'partners' },
    { id: 101, from: 3, to: 6, kind: 'owns' },
  ],
};

const base: GraphFilters = { typeIds: [1, 2], bookId: null, minShared: 1, showLinks: true };
const edges = (f: GraphFilters) =>
  Object.fromEntries(buildGraph(data, f).edges.map((e) => [e.key, [e.shared.map((s) => s.name).join('+'), e.links.map((l) => l.kind).join('+')]]));

describe('buildGraph', () => {
  it('builds co-occurrence edges weighted by shared events, merged with relationships', () => {
    expect(edges(base)).toEqual({
      [edgeKey(1, 2)]: ['Siege', 'partners'],
      [edgeKey(1, 3)]: ['Siege+Fete', ''],
      [edgeKey(1, 4)]: ['Siege', ''],
      [edgeKey(2, 3)]: ['Siege', ''],
      [edgeKey(2, 4)]: ['Siege', ''],
      [edgeKey(3, 4)]: ['Siege', ''],
    });
  });

  it('hides nodes without visible edges and reports how many', () => {
    const g = buildGraph(data, base);
    expect(g.nodes.map((n) => n.name).sort()).toEqual(['Ben', 'Kalam', 'Pale', 'Rake']);
    expect(g.hiddenCount).toBe(1); // Lonely (Sword's type is not shown)
    expect(g.nodes.find((n) => n.name === 'Kalam')!.degree).toBe(3);
  });

  it('drops weak ties but keeps hand-made relationships', () => {
    expect(Object.keys(edges({ ...base, minShared: 2 }))).toEqual([edgeKey(1, 2), edgeKey(1, 3)]);
    expect(edges({ ...base, minShared: 2, showLinks: false })).toEqual({ [edgeKey(1, 3)]: ['Siege+Fete', ''] });
  });

  it('counts only events from the chosen book', () => {
    expect(edges({ ...base, bookId: 2 })).toEqual({
      [edgeKey(1, 2)]: ['', 'partners'],
      [edgeKey(1, 3)]: ['Fete', ''],
    });
  });

  it('shows relationships to newly visible types, and event nodes when events are on', () => {
    expect(edges({ ...base, typeIds: [1, 4] })[edgeKey(3, 6)]).toEqual(['', 'owns']);
    const withEvents = edges({ ...base, typeIds: [1, 3] });
    expect(withEvents[edgeKey(1, 10)]).toEqual(['Siege', '']);
    expect(withEvents[edgeKey(3, 11)]).toEqual(['Fete', '']);
  });
});
