import type { SqlDb } from './types';
import type { FieldDef } from './entityTypes';
import { parseMentionIds } from './mentions';

export type Attributes = Record<string, string | number>;

export interface EntityInput {
  seriesId: number;
  typeId: number;
  name: string;
  description?: string;
  firstBookId?: number | null;
  attributes?: Attributes;
}

export type EntityPatch = Partial<Pick<EntityInput, 'typeId' | 'name' | 'description' | 'firstBookId' | 'attributes'>>;

export interface LinkTarget {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface EntityDetail {
  id: number;
  series_id: number;
  name: string;
  description: string;
  first_book_id: number | null;
  attributes: Attributes;
  created_at: string;
  updated_at: string;
  type: { id: number; key: string; name: string; icon: string; color: string; fields: FieldDef[] };
  firstBook: { id: number; number: number; title: string } | null;
  /** Current names of everything this entry's description links to, by id. */
  links: Record<number, LinkTarget>;
}

export interface EntityListItem {
  id: number;
  name: string;
  type_id: number;
  type_name: string;
  icon: string;
  color: string;
  first_book_number: number | null;
}

const lastId = (db: SqlDb) => db.query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id;

function cleanName(name: string): string {
  const n = name.trim();
  if (!n) throw new Error('Name is required.');
  return n;
}

/** Returns the type's key, or throws if it doesn't belong to the series. */
function typeKey(db: SqlDb, seriesId: number, typeId: number): string {
  const [t] = db.query<{ key: string }>('SELECT key FROM entity_type WHERE id = ? AND series_id = ?', [typeId, seriesId]);
  if (!t) throw new Error('That type does not belong to this series.');
  return t.key;
}

/** Rule 3: rebuild this entity's mention rows from its description (same-series targets only, no self-links). */
function rebuildMentions(db: SqlDb, id: number, seriesId: number, description: string): void {
  db.exec('DELETE FROM mention WHERE source_entity_id = ?', [id]);
  for (const target of parseMentionIds(description)) {
    if (target === id) continue;
    db.exec(
      'INSERT OR IGNORE INTO mention (source_entity_id, target_entity_id) SELECT ?, id FROM entity WHERE id = ? AND series_id = ?',
      [id, target, seriesId],
    );
  }
}

export function createEntity(db: SqlDb, input: EntityInput): number {
  const name = cleanName(input.name);
  return db.transaction(() => {
    const key = typeKey(db, input.seriesId, input.typeId);
    const description = input.description ?? '';
    db.exec(
      `INSERT INTO entity (series_id, type_id, name, description, first_book_id, attributes) VALUES (?, ?, ?, ?, ?, ?)`,
      [input.seriesId, input.typeId, name, description, input.firstBookId ?? null, JSON.stringify(input.attributes ?? {})],
    );
    const id = lastId(db);
    if (key === 'event') db.exec('INSERT INTO event (entity_id) VALUES (?)', [id]); // rule 2
    rebuildMentions(db, id, input.seriesId, description);
    return id;
  });
}

export function updateEntity(db: SqlDb, id: number, patch: EntityPatch): void {
  db.transaction(() => {
    const [cur] = db.query<{ series_id: number; type_id: number }>('SELECT series_id, type_id FROM entity WHERE id = ?', [id]);
    if (!cur) throw new Error('Entry not found.');
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, v: unknown) => {
      sets.push(`${col} = ?`);
      params.push(v);
    };
    if (patch.name !== undefined) set('name', cleanName(patch.name));
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.firstBookId !== undefined) set('first_book_id', patch.firstBookId);
    if (patch.attributes !== undefined) set('attributes', JSON.stringify(patch.attributes));
    if (patch.typeId !== undefined && patch.typeId !== cur.type_id) {
      const wasEvent = typeKey(db, cur.series_id, cur.type_id) === 'event';
      const isEvent = typeKey(db, cur.series_id, patch.typeId) === 'event';
      set('type_id', patch.typeId);
      if (isEvent && !wasEvent) db.exec('INSERT OR IGNORE INTO event (entity_id) VALUES (?)', [id]);
      if (wasEvent && !isEvent) db.exec('DELETE FROM event WHERE entity_id = ?', [id]);
    }
    sets.push(`updated_at = datetime('now')`);
    db.exec(`UPDATE entity SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (patch.description !== undefined) rebuildMentions(db, id, cur.series_id, patch.description);
  });
}

export function deleteEntity(db: SqlDb, id: number): void {
  db.exec('DELETE FROM entity WHERE id = ?', [id]);
}

export function getEntity(db: SqlDb, id: number): EntityDetail | null {
  const [row] = db.query<Record<string, unknown>>(
    `SELECT e.*, t.key AS t_key, t.name AS t_name, t.icon AS t_icon, t.color AS t_color, t.field_schema AS t_fields,
            b.number AS b_number, b.title AS b_title
     FROM entity e JOIN entity_type t ON t.id = e.type_id LEFT JOIN book b ON b.id = e.first_book_id
     WHERE e.id = ?`,
    [id],
  );
  if (!row) return null;
  const links: Record<number, LinkTarget> = {};
  for (const l of db.query<LinkTarget>(
    `SELECT e.id, e.name, t.icon, t.color FROM mention m
     JOIN entity e ON e.id = m.target_entity_id JOIN entity_type t ON t.id = e.type_id
     WHERE m.source_entity_id = ?`,
    [id],
  )) links[l.id] = l;
  return {
    id: row.id as number,
    series_id: row.series_id as number,
    name: row.name as string,
    description: row.description as string,
    first_book_id: row.first_book_id as number | null,
    attributes: JSON.parse(row.attributes as string),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    type: {
      id: row.type_id as number,
      key: row.t_key as string,
      name: row.t_name as string,
      icon: row.t_icon as string,
      color: row.t_color as string,
      fields: JSON.parse(row.t_fields as string),
    },
    firstBook: row.first_book_id
      ? { id: row.first_book_id as number, number: row.b_number as number, title: row.b_title as string }
      : null,
    links,
  };
}

/** Entries whose descriptions link to this one. */
export function backlinks(db: SqlDb, id: number): EntityListItem[] {
  return db.query<EntityListItem>(
    `${LIST_SELECT} JOIN mention m ON m.source_entity_id = e.id WHERE m.target_entity_id = ? ORDER BY e.name COLLATE NOCASE`,
    [id],
  );
}

const LIST_SELECT = `
  SELECT e.id, e.name, e.type_id, t.name AS type_name, t.icon, t.color, b.number AS first_book_number
  FROM entity e JOIN entity_type t ON t.id = e.type_id LEFT JOIN book b ON b.id = e.first_book_id`;

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function listEntities(db: SqlDb, seriesId: number, filter: { typeId?: number | null; search?: string } = {}): EntityListItem[] {
  const where = ['e.series_id = ?'];
  const params: unknown[] = [seriesId];
  if (filter.typeId) {
    where.push('e.type_id = ?');
    params.push(filter.typeId);
  }
  if (filter.search?.trim()) {
    where.push(`e.name LIKE ? ESCAPE '\\'`);
    params.push(`%${likeEscape(filter.search.trim())}%`);
  }
  return db.query<EntityListItem>(`${LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.name COLLATE NOCASE`, params);
}

/** Autocomplete for `@`: prefix matches first, then substring matches. `typeKey` narrows to one type. */
export function searchEntities(db: SqlDb, seriesId: number, typeKey: string | null, term: string, limit = 8): EntityListItem[] {
  const where = ['e.series_id = ?', `e.name LIKE ? ESCAPE '\\'`];
  const t = likeEscape(term.trim());
  const params: unknown[] = [seriesId, `%${t}%`];
  if (typeKey) {
    where.push('t.key = ?');
    params.push(typeKey);
  }
  return db.query<EntityListItem>(
    `${LIST_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY CASE WHEN e.name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, e.name COLLATE NOCASE LIMIT ?`,
    [...params, `${t}%`, limit],
  );
}
