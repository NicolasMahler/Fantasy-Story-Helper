import type { SqlDb } from './types';
import { inSeries, insertId, seriesOf } from './sql';

/** Suggestions for the relationship kind field (free text is allowed). */
export const LINK_KINDS = [
  'ally', 'rival', 'enemy', 'friends', 'partners', 'family', 'parent of', 'child of', 'sibling', 'spouse',
  'member of', 'leads', 'serves', 'mentor of', 'owns', 'worships', 'close to',
];

export interface LinkInput {
  fromId: number;
  toId: number;
  kind: string;
  note?: string;
  startEventId?: number | null;
  endEventId?: number | null;
}

export interface LinkRow {
  id: number;
  kind: string;
  note: string;
  /** 'out' = this entry → other ("Kalam member of Claw"), 'in' = other → this entry. */
  direction: 'out' | 'in';
  other: { id: number; name: string; icon: string; color: string; typeName: string };
  startEvent: { id: number; name: string } | null;
  endEvent: { id: number; name: string } | null;
}


export function createLink(db: SqlDb, input: LinkInput): number {
  const kind = input.kind.trim();
  if (!kind) throw new Error('Choose or type a kind of relationship.');
  if (input.fromId === input.toId) throw new Error('An entry cannot be related to itself.');
  return db.transaction(() => {
    const s = seriesOf(db, 'entity', input.fromId);
    if (s === undefined || !inSeries(db, 'entity', input.toId, s)) throw new Error('Both entries must be in the same series.');
    for (const ev of [input.startEventId, input.endEventId]) {
      if (ev == null) continue;
      const ok = db.query(
        'SELECT 1 FROM event ev JOIN entity e ON e.id = ev.entity_id WHERE ev.entity_id = ? AND e.series_id = ?',
        [ev, s],
      ).length;
      if (!ok) throw new Error('“From” and “until” must be events in this series.');
    }
    const dup = db.query(
      'SELECT 1 FROM entity_link WHERE from_entity_id = ? AND to_entity_id = ? AND kind = ? COLLATE NOCASE',
      [input.fromId, input.toId, kind],
    ).length;
    if (dup) throw new Error(`That relationship (${kind}) already exists.`);
    db.exec(
      `INSERT INTO entity_link (from_entity_id, to_entity_id, kind, note, start_event_id, end_event_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.fromId, input.toId, kind, (input.note ?? '').trim(), input.startEventId ?? null, input.endEventId ?? null],
    );
    return insertId(db);
  });
}

export function deleteLink(db: SqlDb, id: number): void {
  db.exec('DELETE FROM entity_link WHERE id = ?', [id]);
}

/** All relationships touching an entry, from either side, sorted by kind then name. */
export function listLinks(db: SqlDb, entityId: number): LinkRow[] {
  const rows = db.query<{
    id: number; kind: string; note: string; direction: 'out' | 'in';
    o_id: number; o_name: string; o_icon: string; o_color: string; o_type: string;
    s_id: number | null; s_name: string | null; e_id: number | null; e_name: string | null;
  }>(
    `SELECT l.id, l.kind, l.note, x.direction, o.id AS o_id, o.name AS o_name, t.icon AS o_icon, t.color AS o_color,
            t.name AS o_type, s.id AS s_id, s.name AS s_name, en.id AS e_id, en.name AS e_name
     FROM (
       SELECT id, to_entity_id AS other, 'out' AS direction FROM entity_link WHERE from_entity_id = ?
       UNION ALL
       SELECT id, from_entity_id AS other, 'in' AS direction FROM entity_link WHERE to_entity_id = ?
     ) x
     JOIN entity_link l ON l.id = x.id
     JOIN entity o ON o.id = x.other JOIN entity_type t ON t.id = o.type_id
     LEFT JOIN entity s ON s.id = l.start_event_id LEFT JOIN entity en ON en.id = l.end_event_id
     ORDER BY l.kind COLLATE NOCASE, o.name COLLATE NOCASE`,
    [entityId, entityId],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    note: r.note,
    direction: r.direction,
    other: { id: r.o_id, name: r.o_name, icon: r.o_icon, color: r.o_color, typeName: r.o_type },
    startEvent: r.s_id ? { id: r.s_id, name: r.s_name! } : null,
    endEvent: r.e_id ? { id: r.e_id, name: r.e_name! } : null,
  }));
}
