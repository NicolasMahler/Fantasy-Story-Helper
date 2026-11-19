/** Pure graph building for the Graph tab: which nodes and edges are visible under the current filters. */
import type { GraphData, GraphLink, GraphNode } from '../db/graph';
import type { TimelineEvent } from '../db/timeline';

export interface GraphFilters {
  /** Entity types shown as nodes. Including the event type adds event nodes linked to their participants. */
  typeIds: number[];
  /** Only shared events from this book count. Relationships are unaffected. */
  bookId: number | null;
  /** Shared-event ties below this count are hidden (relationships always stay). */
  minShared: number;
  showLinks: boolean;
}

export interface ModelNode extends GraphNode {
  degree: number;
}

export interface ModelEdge {
  key: string;
  /** Smaller id. */
  a: number;
  /** Larger id. */
  b: number;
  shared: TimelineEvent[];
  links: GraphLink[];
}

export const edgeKey = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);

export function buildGraph(
  data: GraphData,
  f: GraphFilters,
): { nodes: ModelNode[]; edges: ModelEdge[]; hiddenCount: number } {
  const shownTypes = new Set(f.typeIds);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const visible = (id: number) => {
    const n = byId.get(id);
    return !!n && shownTypes.has(n.typeId);
  };
  const edges = new Map<string, ModelEdge>();
  const edge = (x: number, y: number) => {
    const key = edgeKey(x, y);
    let e = edges.get(key);
    if (!e) {
      e = { key, a: Math.min(x, y), b: Math.max(x, y), shared: [], links: [] };
      edges.set(key, e);
    }
    return e;
  };

  for (const ev of data.events) {
    if (f.bookId !== null && ev.bookId !== f.bookId) continue;
    const people = [...new Set(ev.participants.map((p) => p.entityId))].filter((id) => id !== ev.id && visible(id));
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) edge(people[i], people[j]).shared.push(ev);
    }
    if (visible(ev.id)) for (const p of people) edge(ev.id, p).shared.push(ev);
  }

  if (f.showLinks) {
    for (const l of data.links) if (visible(l.from) && visible(l.to)) edge(l.from, l.to).links.push(l);
  }

  const kept = [...edges.values()].filter((e) => e.links.length > 0 || (e.shared.length > 0 && e.shared.length >= f.minShared));
  const degree = new Map<number, number>();
  for (const e of kept) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const candidates = data.nodes.filter((n) => shownTypes.has(n.typeId));
  const nodes = candidates.filter((n) => degree.has(n.id)).map((n) => ({ ...n, degree: degree.get(n.id)! }));
  return { nodes, edges: kept, hiddenCount: candidates.length - nodes.length };
}
