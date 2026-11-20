import type { SqlDb } from './types';
import type { FieldDef } from './entityTypes';
import { stripMentions } from './mentions';
import { likeEscape } from './sql';

export interface Snippet {
  text: string;
  /** Where the match starts in `text` (for highlighting). */
  start: number;
  length: number;
}

export interface SearchResult {
  kind: 'entity' | 'book' | 'age' | 'series';
  id: number;
  seriesId: number;
  name: string;
  icon: string;
  color: string;
  /** What kind of thing it is, e.g. "Character", "Book", "Age". */
  typeName: string;
  /** Which field matched: 'name', 'description', 'relationship', 'title', or a custom field's label. */
  field: string;
  snippet: Snippet | null;
}

const BEFORE = 40;
const AFTER = 70;

/** Snippet around the first match, with `@` links shown as their names. */
export function makeSnippet(text: string, q: string): Snippet {
  const plain = stripMentions(text).replace(/\s+/g, ' ').trim();
  const idx = plain.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return { text: plain.length > BEFORE + AFTER ? `${plain.slice(0, BEFORE + AFTER)}…` : plain, start: 0, length: 0 };
  const from = Math.max(0, idx - BEFORE);
  const to = Math.min(plain.length, idx + q.length + AFTER);
  const prefix = from > 0 ? '…' : '';
  return { text: `${prefix}${plain.slice(from, to)}${to < plain.length ? '…' : ''}`, start: idx - from + prefix.length, length: q.length };
}

/** Search one series (or everything when `seriesId` is null). Best matches first. */
export function search(db: SqlDb, opts: { seriesId: number | null; q: string; limit?: number }): SearchResult[] {
  const q = opts.q.trim();
  if (!q) return [];
  const ql = q.toLowerCase();
  const like = `%${likeEscape(q)}%`;
  const scope = opts.seriesId === null ? '1 = 1' : 'e.series_id = ?';
  const scopeParams = opts.seriesId === null ? [] : [opts.seriesId];
  const ranked: { rank: number; r: SearchResult }[] = [];

  if (opts.seriesId === null) {
    for (const s of db.query<{ id: number; name: string; description: string }>(
      `SELECT id, name, description FROM series WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'`, [like, like],
    )) {
      const inName = s.name.toLowerCase().includes(ql);
      ranked.push({
        rank: s.name.toLowerCase().startsWith(ql) ? -1 : inName ? 0 : 2,
        r: {
          kind: 'series', id: s.id, seriesId: s.id, name: s.name, icon: 'books', color: '#a58cf0', typeName: 'Series',
          field: inName ? 'name' : 'description', snippet: inName ? null : makeSnippet(s.description, q),
        },
      });
    }
  }

  const entities = db.query<{
    id: number; series_id: number; name: string; aliases: string; description: string; attributes: string;
    icon: string; color: string; type_name: string; field_schema: string;
  }>(
    `SELECT e.id, e.series_id, e.name, e.aliases, e.description, e.attributes, t.icon, t.color, t.name AS type_name, t.field_schema
     FROM entity e JOIN entity_type t ON t.id = e.type_id
     WHERE ${scope} AND (e.name LIKE ? ESCAPE '\\' OR e.aliases LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\'
       OR e.attributes LIKE ? ESCAPE '\\'
       OR e.id IN (SELECT from_entity_id FROM entity_link WHERE kind LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\'))`,
    [...scopeParams, like, like, like, like, like, like],
  );
  // First matching relationship per entity, fetched in one query rather than one per entity.
  const linkHits = new Map<number, { kind: string; note: string; other: string }>();
  for (const l of db.query<{ from_id: number; kind: string; note: string; other: string }>(
    `SELECT l.from_entity_id AS from_id, l.kind, l.note, o.name AS other
     FROM entity_link l JOIN entity e ON e.id = l.from_entity_id JOIN entity o ON o.id = l.to_entity_id
     WHERE ${scope} AND (l.kind LIKE ? ESCAPE '\\' OR l.note LIKE ? ESCAPE '\\') ORDER BY l.id`,
    [...scopeParams, like, like],
  )) if (!linkHits.has(l.from_id)) linkHits.set(l.from_id, l);

  for (const e of entities) {
    const base = { kind: 'entity' as const, id: e.id, seriesId: e.series_id, name: e.name, icon: e.icon, color: e.color, typeName: e.type_name };
    const name = e.name.toLowerCase();
    if (name.includes(ql)) {
      ranked.push({ rank: name.startsWith(ql) ? 0 : 1, r: { ...base, field: 'name', snippet: null } });
      continue;
    }
    const alias = (JSON.parse(e.aliases) as string[]).find((a) => a.toLowerCase().includes(ql));
    if (alias) {
      const text = `Also known as ${alias}`;
      const at = text.toLowerCase().indexOf(ql, 'Also known as '.length);
      ranked.push({
        rank: alias.toLowerCase().startsWith(ql) ? 0 : 1,
        r: { ...base, field: 'also known as', snippet: { text, start: at, length: q.length } },
      });
      continue;
    }
    if (stripMentions(e.description).toLowerCase().includes(ql)) {
      ranked.push({ rank: 2, r: { ...base, field: 'description', snippet: makeSnippet(e.description, q) } });
      continue;
    }
    const attrs = JSON.parse(e.attributes) as Record<string, unknown>;
    const fields = JSON.parse(e.field_schema) as FieldDef[];
    const hit = Object.entries(attrs).find(([, v]) => String(v).toLowerCase().includes(ql));
    if (hit) {
      const label = fields.find((f) => f.key === hit[0])?.label ?? hit[0];
      ranked.push({ rank: 2, r: { ...base, field: label, snippet: makeSnippet(String(hit[1]), q) } });
      continue;
    }
    const link = linkHits.get(e.id);
    if (link) {
      const text = `${link.kind} ${link.other}${link.note ? `: ${link.note}` : ''}`;
      ranked.push({ rank: 3, r: { ...base, field: 'relationship', snippet: makeSnippet(text, q) } });
    }
  }

  for (const b of db.query<{ id: number; series_id: number; number: number; title: string }>(
    `SELECT e.id, e.series_id, e.number, e.title FROM book e WHERE ${scope} AND e.title LIKE ? ESCAPE '\\'`, [...scopeParams, like],
  )) {
    ranked.push({
      rank: 3,
      r: { kind: 'book', id: b.id, seriesId: b.series_id, name: `Book ${b.number}: ${b.title}`, icon: 'book', color: '#8a8f99', typeName: 'Book', field: 'title', snippet: null },
    });
  }
  for (const a of db.query<{ id: number; series_id: number; name: string }>(
    `SELECT e.id, e.series_id, e.name FROM age e WHERE ${scope} AND e.name LIKE ? ESCAPE '\\'`, [...scopeParams, like],
  )) {
    ranked.push({
      rank: 3,
      r: { kind: 'age', id: a.id, seriesId: a.series_id, name: a.name, icon: 'hourglass', color: '#a58cf0', typeName: 'Age', field: 'name', snippet: null },
    });
  }

  return ranked
    .sort((x, y) => x.rank - y.rank || x.r.name.localeCompare(y.r.name))
    .slice(0, opts.limit ?? 50)
    .map((x) => x.r);
}
