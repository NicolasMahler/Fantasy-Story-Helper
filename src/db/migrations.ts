import type { SqlDb } from './types';
import schemaV1 from './schema.sql?raw';

/** v2: app-level key/value settings (e.g. last_export_at). Not part of JSON dumps. */
const appMeta = 'CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;';

/**
 * v3: built-in types switch from emoji to named line icons (src/lib/icons.ts). Only types still showing
 * the emoji they were seeded with change, so icons people picked themselves are kept.
 */
export const LINE_ICONS_SQL = [
  ['character', '👤', 'user'], ['location', '📍', 'building-castle'], ['event', '⚡', 'swords'],
  ['people', '👥', 'users-group'], ['faction', '🛡️', 'shield'], ['item', '🗝️', 'diamond'],
  ['magic', '✨', 'wand'], ['creature', '🐉', 'paw'], ['religion', '🕯️', 'flame'], ['lore', '📜', 'script'],
]
  .map(([key, emoji, icon]) => `UPDATE entity_type SET icon = '${icon}' WHERE key = '${key}' AND icon = '${emoji}';`)
  .join('\n');

/**
 * Ordered migrations; index + 1 is the resulting PRAGMA user_version. Never edit a shipped one.
 *   v1: schema.sql (initial schema)
 *   v2: app_meta
 *   v3: line icons for built-in types
 */
export const MIGRATIONS: string[] = [schemaV1, appMeta, LINE_ICONS_SQL];

export function currentVersion(db: SqlDb): number {
  return db.query<{ user_version: number }>('PRAGMA user_version')[0].user_version;
}

/** Applies pending migrations, each in its own transaction. Returns the final version. */
export function migrate(db: SqlDb, migrations: string[] = MIGRATIONS): number {
  let version = currentVersion(db);
  if (version > migrations.length) {
    throw new Error(
      `This database was made by a newer version of the app (schema v${version}, app knows v${migrations.length}).`,
    );
  }
  for (; version < migrations.length; version++) {
    const next = version + 1;
    db.transaction(() => {
      db.exec(migrations[version]);
      db.exec(`PRAGMA user_version = ${next}`);
    });
  }
  return version;
}
