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

/** v4: other names an entry goes by ("Surly" for Laseen), as a JSON array of strings. */
const aliases = `ALTER TABLE entity ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases));`;

/** v5: theories and open questions, a built-in entry type with a status (1:1 extension of entity, like event). */
const theoryTable = `
CREATE TABLE theory (
  entity_id        INTEGER PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL DEFAULT 'theory' CHECK (kind IN ('theory', 'question')),
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'wrong', 'answered')),
  resolved_book_id INTEGER REFERENCES book(id) ON DELETE SET NULL,  -- where it was settled
  resolution       TEXT NOT NULL DEFAULT '',                        -- how it was settled
  CHECK (kind = 'theory' OR status IN ('open', 'answered')),
  CHECK (kind = 'question' OR status <> 'answered')
);
CREATE INDEX idx_theory_book ON theory(resolved_book_id);`;

/**
 * Gives every series the built-in Theory type (last in the list) and every Theory entry its theory row.
 * Safe to run again: also used after JSON imports from before v5. A custom type already keyed `theory`
 * becomes the built-in one.
 */
export const THEORY_TYPE_SQL = `
UPDATE entity_type SET is_builtin = 1 WHERE key = 'theory';
INSERT INTO entity_type (series_id, key, name, icon, color, is_builtin, sort_order)
  SELECT s.id, 'theory', 'Theory', 'bulb', '#c46f9b', 1,
         (SELECT COALESCE(MAX(t.sort_order), -1) + 1 FROM entity_type t WHERE t.series_id = s.id)
  FROM series s WHERE NOT EXISTS (SELECT 1 FROM entity_type t WHERE t.series_id = s.id AND t.key = 'theory');
INSERT OR IGNORE INTO theory (entity_id)
  SELECT e.id FROM entity e JOIN entity_type t ON t.id = e.type_id WHERE t.key = 'theory';`;

/** v6: quotes from the books, filed under an entry; on a theory they count as evidence for or against. */
const quoteTable = `
CREATE TABLE quote (
  id                INTEGER PRIMARY KEY,
  entity_id         INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,  -- the entry it is filed under
  text              TEXT NOT NULL,
  book_id           INTEGER REFERENCES book(id) ON DELETE SET NULL,
  chapter           TEXT NOT NULL DEFAULT '',                                  -- free text: "Ch. 12", "p. 340"
  speaker_entity_id INTEGER REFERENCES entity(id) ON DELETE SET NULL,
  note              TEXT NOT NULL DEFAULT '',
  stance            TEXT CHECK (stance IN ('for', 'against')),                 -- theories only
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_quote_entity  ON quote(entity_id);
CREATE INDEX idx_quote_speaker ON quote(speaker_entity_id);
CREATE INDEX idx_quote_book    ON quote(book_id);`;

/**
 * Ordered migrations; index + 1 is the resulting PRAGMA user_version. Never edit a shipped one.
 *   v1: schema.sql (initial schema)
 *   v2: app_meta
 *   v3: line icons for built-in types
 *   v4: entity.aliases
 *   v5: theory table and the built-in Theory type
 *   v6: quote table
 */
export const MIGRATIONS: string[] = [schemaV1, appMeta, LINE_ICONS_SQL, aliases, theoryTable + THEORY_TYPE_SQL, quoteTable];

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
