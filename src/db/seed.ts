import type { SqlDb } from './types';

export interface DefaultEntityType {
  key: string;
  name: string;
  icon: string;
  color: string;
  is_builtin: 0 | 1;
}

/** Seeded into every new series, in this display order. Only `event` is built in. */
export const DEFAULT_ENTITY_TYPES: DefaultEntityType[] = [
  { key: 'character', name: 'Character', icon: '👤', color: '#5b8def', is_builtin: 0 },
  { key: 'location',  name: 'Location',  icon: '📍', color: '#3fa66b', is_builtin: 0 },
  { key: 'event',     name: 'Event',     icon: '⚡', color: '#e0a030', is_builtin: 1 },
  { key: 'people',    name: 'People',    icon: '👥', color: '#9a6fd6', is_builtin: 0 },
  { key: 'faction',   name: 'Faction',   icon: '🛡️', color: '#d0584f', is_builtin: 0 },
  { key: 'item',      name: 'Item',      icon: '🗝️', color: '#c9a227', is_builtin: 0 },
  { key: 'magic',     name: 'Magic',     icon: '✨', color: '#4fb8c9', is_builtin: 0 },
  { key: 'creature',  name: 'Creature',  icon: '🐉', color: '#7a9a3a', is_builtin: 0 },
  { key: 'religion',  name: 'Religion',  icon: '🕯️', color: '#b5835a', is_builtin: 0 },
  { key: 'lore',      name: 'Lore',      icon: '📜', color: '#8a8f99', is_builtin: 0 },
];

/** Default positions (in years on the master axis) for vague dates. Editable per series. */
export const DEFAULT_BUCKETS = [
  { bucket: 'mythic',  label: 'In myth',          sort_key: -1_000_000 },
  { bucket: 'ancient', label: 'In ancient times', sort_key: -100_000 },
  { bucket: 'distant', label: 'Long ago',         sort_key: -10_000 },
  { bucket: 'recent',  label: 'Not long ago',     sort_key: -100 },
  { bucket: 'present', label: 'Present day',      sort_key: 0 },
] as const;

/** Creates a series and seeds its default entity types and date buckets. Returns the new id. */
export function createSeries(db: SqlDb, input: { name: string; description?: string }): number {
  const name = input.name.trim();
  if (!name) throw new Error('Series name is required.');
  return db.transaction(() => {
    db.exec('INSERT INTO series (name, description) VALUES (?, ?)', [name, input.description?.trim() ?? '']);
    const id = db.query<{ id: number }>('SELECT last_insert_rowid() AS id')[0].id;
    DEFAULT_ENTITY_TYPES.forEach((t, i) =>
      db.exec(
        'INSERT INTO entity_type (series_id, key, name, icon, color, is_builtin, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, t.key, t.name, t.icon, t.color, t.is_builtin, i],
      ),
    );
    for (const b of DEFAULT_BUCKETS) {
      db.exec('INSERT INTO bucket_default (series_id, bucket, label, sort_key) VALUES (?, ?, ?, ?)', [
        id, b.bucket, b.label, b.sort_key,
      ]);
    }
    return id;
  });
}

/** Deletes a series and (via ON DELETE CASCADE) everything that belongs to it. */
export function deleteSeries(db: SqlDb, id: number): void {
  db.transaction(() => {
    // Relative dates would be SET NULL mid-delete and trip the event CHECK, so detach them first.
    db.exec(
      `UPDATE event SET date_precision = NULL, relative_to_event = NULL, offset_years = NULL
       WHERE relative_to_event IS NOT NULL AND entity_id IN (SELECT id FROM entity WHERE series_id = ?)`,
      [id],
    );
    // entity.type_id is RESTRICT, so remove entities before their types cascade away.
    db.exec('DELETE FROM entity WHERE series_id = ?', [id]);
    db.exec('DELETE FROM series WHERE id = ?', [id]);
  });
}
