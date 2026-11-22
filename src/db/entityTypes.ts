import type { SqlDb } from './types';
import { plural, slugify as slugifyText } from '../lib/text';
import { insertId } from './sql';

export type FieldKind = 'text' | 'longtext' | 'number';
export const FIELD_KINDS: { kind: FieldKind; label: string }[] = [
  { kind: 'text', label: 'Short text' },
  { kind: 'longtext', label: 'Long text' },
  { kind: 'number', label: 'Number' },
];

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
}

export interface EntityTypeRow {
  id: number;
  key: string;
  name: string;
  icon: string;
  color: string;
  is_builtin: 0 | 1;
  sort_order: number;
  fields: FieldDef[];
  /** Number of entries of this type. */
  usage: number;
}

export interface TypeInput {
  name: string;
  icon: string;
  color: string;
  fields: FieldDef[];
}

/** Slug for type and field keys; falls back to 'type'. */
export const slugify = (s: string): string => slugifyText(s, 'type');

export function listTypes(db: SqlDb, seriesId: number): EntityTypeRow[] {
  return db
    .query<Omit<EntityTypeRow, 'fields'> & { field_schema: string }>(
      `SELECT t.id, t.key, t.name, t.icon, t.color, t.is_builtin, t.sort_order, t.field_schema,
              (SELECT COUNT(*) FROM entity e WHERE e.type_id = t.id) AS usage
       FROM entity_type t WHERE t.series_id = ? ORDER BY t.sort_order, t.id`,
      [seriesId],
    )
    .map(({ field_schema, ...t }) => ({ ...t, fields: JSON.parse(field_schema) as FieldDef[] }));
}

function validate(input: TypeInput): TypeInput {
  const name = input.name.trim();
  if (!name) throw new Error('Type name is required.');
  const seen = new Set<string>();
  const fields = input.fields.map((f) => {
    const label = f.label.trim();
    const key = (f.key || slugify(label)).trim();
    if (!label) throw new Error('Every field needs a label.');
    if (!FIELD_KINDS.some((k) => k.kind === f.kind)) throw new Error(`Unknown field kind "${f.kind}".`);
    if (seen.has(key)) throw new Error(`Two fields share the key "${key}". Give them different labels.`);
    seen.add(key);
    return { key, label, kind: f.kind };
  });
  return { name, icon: input.icon.trim(), color: input.color || '#888888', fields };
}

/** Creates a custom type. Its key (used in `@key:`) is derived from the name and never changes. */
export function createType(db: SqlDb, seriesId: number, input: TypeInput): number {
  const t = validate(input);
  return db.transaction(() => {
    const base = slugify(t.name);
    const taken = new Set(
      db.query<{ key: string }>('SELECT key FROM entity_type WHERE series_id = ?', [seriesId]).map((r) => r.key),
    );
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    db.exec(
      `INSERT INTO entity_type (series_id, key, name, icon, color, field_schema, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM entity_type WHERE series_id = ?))`,
      [seriesId, key, t.name, t.icon, t.color, JSON.stringify(t.fields), seriesId],
    );
    return insertId(db);
  });
}

export function updateType(db: SqlDb, id: number, input: TypeInput): void {
  const t = validate(input);
  db.exec('UPDATE entity_type SET name = ?, icon = ?, color = ?, field_schema = ? WHERE id = ?', [
    t.name, t.icon, t.color, JSON.stringify(t.fields), id,
  ]);
}

export function deleteType(db: SqlDb, id: number): void {
  const [t] = db.query<{ is_builtin: number; usage: number }>(
    `SELECT is_builtin, (SELECT COUNT(*) FROM entity WHERE type_id = ?) AS usage FROM entity_type WHERE id = ?`,
    [id, id],
  );
  if (!t) return;
  if (t.is_builtin) throw new Error('Built-in types (Event, Theory) cannot be deleted.');
  if (t.usage > 0) throw new Error(`This type is in use by ${plural(t.usage, 'entry', 'entries')}.`);
  db.exec('DELETE FROM entity_type WHERE id = ?', [id]);
}
