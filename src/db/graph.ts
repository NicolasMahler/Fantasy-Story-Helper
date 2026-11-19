import type { SqlDb } from './types';
import { getTimeline, type TimelineBook, type TimelineEvent } from './timeline';

export interface GraphNode {
  id: number;
  name: string;
  typeId: number;
  typeKey: string;
  icon: string;
  color: string;
}

export interface GraphType {
  id: number;
  key: string;
  name: string;
  icon: string;
  color: string;
}

export interface GraphLink {
  id: number;
  from: number;
  to: number;
  kind: string;
}

export interface GraphData {
  nodes: GraphNode[];
  types: GraphType[];
  books: TimelineBook[];
  /** Events with labels and participants (same shape as the timeline). */
  events: TimelineEvent[];
  links: GraphLink[];
}

/** Everything the Graph tab needs for one series. */
export function getGraph(db: SqlDb, seriesId: number): GraphData {
  const { events, books } = getTimeline(db, seriesId);
  const types = db.query<GraphType>(
    'SELECT id, key, name, icon, color FROM entity_type WHERE series_id = ? ORDER BY sort_order, id',
    [seriesId],
  );
  const nodes = db.query<GraphNode>(
    `SELECT e.id, e.name, t.id AS typeId, t.key AS typeKey, t.icon, t.color
     FROM entity e JOIN entity_type t ON t.id = e.type_id WHERE e.series_id = ? ORDER BY e.name COLLATE NOCASE`,
    [seriesId],
  );
  const links = db.query<GraphLink>(
    `SELECT l.id, l.from_entity_id AS "from", l.to_entity_id AS "to", l.kind
     FROM entity_link l JOIN entity e ON e.id = l.from_entity_id WHERE e.series_id = ? ORDER BY l.id`,
    [seriesId],
  );
  return { nodes, types, books, events, links };
}
