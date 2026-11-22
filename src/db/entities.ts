import type { SqlDb } from './types';
import { insertId, likeEscape } from './sql';
import type { FieldDef } from './entityTypes';
import { parseMentionIds, stripMentions } from './mentions';
import { freezeDependents, recomputeSeries } from './events';
import type { TheoryKind, TheoryStatus } from './theories';

export type Attributes = Record<string, string | number>;

export interface EntityInput {
  seriesId: number;
  typeId: number;
  name: string;
  description?: string;
  firstBookId?: number | null;
  attributes?: Attributes;
  /** Other names the entry goes by. */
  aliases?: string[];
}

export type EntityPatch = Partial<Pick<EntityInput, 'typeId' | 'name' | 'description' | 'firstBookId' | 'attributes' | 'aliases'>>;

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
  aliases: string[];
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
  /** For theories: whether it's a theory or a question, and where it stands. Null for other entries. */
  theory_kind: TheoryKind | null;
  theory_status: TheoryStatus | null;
  /** Set by searches when the entry matched on one of its other names rather than its name. */
  alias?: string;
  /** Set by the entries search when only the description matched: the text around the match. */
  snippet?: string;
}

const LIST_SELECT = `
  SELECT e.id, e.name, e.type_id, t.name AS type_name, t.icon, t.color, th.kind AS theory_kind, th.status AS theory_status,
         b.number AS first_book_number
  FROM entity e JOIN entity_type t ON t.id = e.type_id LEFT JOIN book b ON b.id = e.first_book_id
  LEFT JOIN theory th ON th.entity_id = e.id`;

function cleanName(name: string): string {
  const n = name.trim();
  if (!n) throw new Error('Name is required.');
  return n;
}

/** Trimmed, without blanks, repeats (ignoring case) or the entry's own name. */
export function cleanAliases(aliases: string[], name: string): string[] {
  const seen = new Set([name.trim().toLowerCase()]);
  const out: string[] = [];
  for (const a of aliases) {
    const v = a.trim().replace(/\s+/g, ' ');
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

/** Returns the type's key, or throws if it doesn't belong to the series. */
function typeKey(db: SqlDb, seriesId: number, typeId: number): string {
  const [t] = db.query<{ key: string }>('SELECT key FROM entity_type WHERE id = ? AND series_id = ?', [typeId, seriesId]);
  if (!t) throw new Error('That type does not belong to this series.');
  return t.key;
}

/** Returns the book id (or null), or throws if the book doesn't belong to the series. */
function firstBook(db: SqlDb, seriesId: number, bookId: number | null | undefined): number | null {
  if (bookId == null) return null;
  if (!db.query('SELECT 1 FROM book WHERE id = ? AND series_id = ?', [bookId, seriesId]).length) {
    throw new Error('That book does not belong to this series.');
  }
  return bookId;
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
      `INSERT INTO entity (series_id, type_id, name, description, first_book_id, attributes, aliases) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.seriesId, input.typeId, name, description, firstBook(db, input.seriesId, input.firstBookId), JSON.stringify(input.attributes ?? {}),
        JSON.stringify(cleanAliases(input.aliases ?? [], name)),
      ],
    );
    const id = insertId(db);
    if (key === 'event') db.exec('INSERT INTO event (entity_id) VALUES (?)', [id]); // rule 2
    if (key === 'theory') db.exec('INSERT INTO theory (entity_id) VALUES (?)', [id]);
    rebuildMentions(db, id, input.seriesId, description);
    return id;
  });
}

export function updateEntity(db: SqlDb, id: number, patch: EntityPatch): void {
  db.transaction(() => {
    const [cur] = db.query<{ series_id: number; type_id: number; name: string; aliases: string }>(
      'SELECT series_id, type_id, name, aliases FROM entity WHERE id = ?', [id],
    );
    if (!cur) throw new Error('Entry not found.');
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, v: unknown) => {
      sets.push(`${col} = ?`);
      params.push(v);
    };
    if (patch.name !== undefined) set('name', cleanName(patch.name));
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.firstBookId !== undefined) set('first_book_id', firstBook(db, cur.series_id, patch.firstBookId));
    if (patch.attributes !== undefined) set('attributes', JSON.stringify(patch.attributes));
    // Re-clean on a rename too, so an entry never lists its own name as another name.
    if (patch.aliases !== undefined || patch.name !== undefined) {
      const list = patch.aliases ?? (JSON.parse(cur.aliases) as string[]);
      set('aliases', JSON.stringify(cleanAliases(list, patch.name ?? cur.name)));
    }
    // Sort keys only depend on event rows, so only an Event ↔ non-Event retype can change them.
    let eventsChanged = false;
    if (patch.typeId !== undefined && patch.typeId !== cur.type_id) {
      const fromKey = typeKey(db, cur.series_id, cur.type_id);
      const toKey = typeKey(db, cur.series_id, patch.typeId);
      const wasEvent = fromKey === 'event';
      const isEvent = toKey === 'event';
      set('type_id', patch.typeId);
      if (isEvent && !wasEvent) db.exec('INSERT OR IGNORE INTO event (entity_id) VALUES (?)', [id]);
      if (wasEvent && !isEvent) {
        freezeDependents(db, id);
        db.exec('DELETE FROM event WHERE entity_id = ?', [id]);
      }
      eventsChanged = wasEvent !== isEvent;
      if (toKey === 'theory') db.exec('INSERT OR IGNORE INTO theory (entity_id) VALUES (?)', [id]);
      if (fromKey === 'theory' && toKey !== 'theory') db.exec('DELETE FROM theory WHERE entity_id = ?', [id]);
    }
    sets.push(`updated_at = datetime('now')`);
    db.exec(`UPDATE entity SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (patch.description !== undefined) rebuildMentions(db, id, cur.series_id, patch.description);
    if (eventsChanged) recomputeSeries(db, cur.series_id);
  });
}

export function deleteEntity(db: SqlDb, id: number): void {
  db.transaction(() => {
    const [cur] = db.query<{ series_id: number; is_event: number }>(
      'SELECT series_id, EXISTS (SELECT 1 FROM event WHERE entity_id = entity.id) AS is_event FROM entity WHERE id = ?',
      [id],
    );
    if (!cur) return;
    if (cur.is_event) freezeDependents(db, id);
    db.exec('DELETE FROM entity WHERE id = ?', [id]);
    if (cur.is_event) recomputeSeries(db, cur.series_id);
  });
}

/** Columns of the getEntity query. */
interface EntityRow {
  id: number; series_id: number; type_id: number; name: string; description: string; first_book_id: number | null;
  attributes: string; aliases: string; created_at: string; updated_at: string;
  t_key: string; t_name: string; t_icon: string; t_color: string; t_fields: string;
  b_number: number | null; b_title: string | null;
}

export function getEntity(db: SqlDb, id: number): EntityDetail | null {
  const [row] = db.query<EntityRow>(
    `SELECT e.id, e.series_id, e.type_id, e.name, e.description, e.first_book_id, e.attributes, e.aliases, e.created_at, e.updated_at,
            t.key AS t_key, t.name AS t_name, t.icon AS t_icon, t.color AS t_color, t.field_schema AS t_fields,
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
    id: row.id,
    series_id: row.series_id,
    name: row.name,
    description: row.description,
    first_book_id: row.first_book_id,
    attributes: JSON.parse(row.attributes) as Attributes,
    aliases: JSON.parse(row.aliases) as string[],
    created_at: row.created_at,
    updated_at: row.updated_at,
    type: {
      id: row.type_id,
      key: row.t_key,
      name: row.t_name,
      icon: row.t_icon,
      color: row.t_color,
      fields: JSON.parse(row.t_fields) as FieldDef[],
    },
    firstBook: row.first_book_id ? { id: row.first_book_id, number: row.b_number!, title: row.b_title! } : null,
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

/** Rows of a search query: list columns plus what's needed to explain the match. */
type SearchRow = EntityListItem & { aliases: string; description: string };

const SEARCH_SELECT = LIST_SELECT.replace('b.number AS first_book_number', 'b.number AS first_book_number, e.aliases, e.description');

/** The first alias containing `term` (any case), if any. */
function aliasMatch(aliasesJson: string, term: string): string | undefined {
  const t = term.toLowerCase();
  return (JSON.parse(aliasesJson) as string[]).find((a) => a.toLowerCase().includes(t));
}

/** Plain-text excerpt around the first match of `term`. */
function excerpt(description: string, term: string): string | undefined {
  const plain = stripMentions(description).replace(/\s+/g, ' ').trim();
  const i = plain.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return undefined;
  // Start and end on word boundaries where there is one nearby.
  let from = Math.max(0, i - 30);
  if (from > 0) {
    const space = plain.indexOf(' ', from);
    if (space >= 0 && space < i) from = space + 1;
  }
  let to = Math.min(plain.length, i + term.length + 50);
  if (to < plain.length) {
    const space = plain.lastIndexOf(' ', to);
    if (space > i + term.length) to = space;
  }
  return `${from > 0 ? '…' : ''}${plain.slice(from, to)}${to < plain.length ? '…' : ''}`;
}

/**
 * Entries of a series, optionally of one type. With `search`, entries match on their name, another name
 * (alias) or their description, in that order of preference. `theoryStatus` keeps only theories with that status.
 */
export function listEntities(
  db: SqlDb,
  seriesId: number,
  filter: { typeId?: number | null; search?: string; theoryStatus?: TheoryStatus | null } = {},
): EntityListItem[] {
  const where = ['e.series_id = ?'];
  const params: unknown[] = [seriesId];
  if (filter.typeId) {
    where.push('e.type_id = ?');
    params.push(filter.typeId);
  }
  if (filter.theoryStatus) {
    where.push('th.status = ?');
    params.push(filter.theoryStatus);
  }
  const term = filter.search?.trim();
  if (!term) return db.query<EntityListItem>(`${LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.name COLLATE NOCASE`, params);

  const like = `%${likeEscape(term)}%`;
  where.push(`(e.name LIKE ? ESCAPE '\\' OR e.aliases LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\')`);
  const rows = db.query<SearchRow>(
    `${SEARCH_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.name COLLATE NOCASE`, [...params, like, like, like],
  );
  const t = term.toLowerCase();
  const ranked: { rank: number; item: EntityListItem }[] = [];
  for (const { aliases, description, ...item } of rows) {
    if (item.name.toLowerCase().includes(t)) {
      ranked.push({ rank: 0, item });
      continue;
    }
    const alias = aliasMatch(aliases, term);
    if (alias) {
      ranked.push({ rank: 1, item: { ...item, alias } });
      continue;
    }
    // LIKE also matches link markup (`@[Name](12)`); keep only matches in the text people see.
    const snippet = excerpt(description, term);
    if (snippet) ranked.push({ rank: 2, item: { ...item, snippet } });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.item);
}

/**
 * Autocomplete for `@` and entry pickers, matching names and other names (aliases): name prefix matches
 * first, then other name matches, then other names. `typeFilter` (a type key) narrows to one type.
 */
export function searchEntities(db: SqlDb, seriesId: number, typeFilter: string | null, term: string, limit = 8): EntityListItem[] {
  const q = term.trim();
  const t = likeEscape(q);
  const where = ['e.series_id = ?', `(e.name LIKE ? ESCAPE '\\' OR e.aliases LIKE ? ESCAPE '\\')`];
  const params: unknown[] = [seriesId, `%${t}%`, `%${t}%`];
  if (typeFilter) {
    where.push('t.key = ?');
    params.push(typeFilter);
  }
  const rows = db.query<SearchRow>(
    `${SEARCH_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY CASE WHEN e.name LIKE ? ESCAPE '\\' THEN 0 WHEN e.name LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, e.name COLLATE NOCASE`,
    [...params, `${t}%`, `%${t}%`],
  );
  const out: EntityListItem[] = [];
  for (const { aliases, description: _description, ...item } of rows) {
    if (out.length === limit) break;
    if (item.name.toLowerCase().includes(q.toLowerCase())) out.push(item);
    else {
      // The LIKE on the JSON text can match its quotes and commas; confirm against the real names.
      const alias = aliasMatch(aliases, q);
      if (alias) out.push({ ...item, alias });
    }
  }
  return out;
}
