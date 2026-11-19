-- Fantasy Series Reading Companion — database schema (v1)
-- Rebuilt from HANDOFF.md. Run `PRAGMA foreign_keys = ON` on every connection open.
-- JSON columns are TEXT validated with json_valid().

-- ───────────── Series, books, ages ─────────────

CREATE TABLE series (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE book (
  id        INTEGER PRIMARY KEY,
  series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  number    INTEGER NOT NULL,             -- reading order: Book 1, Book 2, ...
  title     TEXT NOT NULL,
  UNIQUE (series_id, number)
);

-- "Year X of Age Y". start_year/end_year are positions on the master axis (years).
CREATE TABLE age (
  id         INTEGER PRIMARY KEY,
  series_id  INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year   INTEGER,                      -- NULL = ongoing / unknown
  direction  TEXT NOT NULL DEFAULT 'forward' CHECK (direction IN ('forward', 'backward')),
  UNIQUE (series_id, name)
);

-- ───────────── Entity types & entities ─────────────

CREATE TABLE entity_type (
  id           INTEGER PRIMARY KEY,
  series_id    INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,              -- slug used in @key: prefixes, e.g. 'character'
  name         TEXT NOT NULL,              -- display name, e.g. 'Character'
  icon         TEXT NOT NULL DEFAULT '',
  color        TEXT NOT NULL DEFAULT '#888888',
  field_schema TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(field_schema)),
  is_builtin   INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),  -- 1 = not deletable (event)
  sort_order   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (series_id, key)
);

CREATE TABLE entity (
  id            INTEGER PRIMARY KEY,
  series_id     INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  type_id       INTEGER NOT NULL REFERENCES entity_type(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',  -- may contain @mentions
  first_book_id INTEGER REFERENCES book(id) ON DELETE SET NULL,
  attributes    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_entity_series_type ON entity(series_id, type_id);
CREATE INDEX idx_entity_name        ON entity(series_id, name COLLATE NOCASE);

-- ───────────── Events (1:1 extension of entity) ─────────────

CREATE TABLE event (
  entity_id         INTEGER PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  mode              TEXT NOT NULL DEFAULT 'present' CHECK (mode IN ('present', 'recounted')),
  book_id           INTEGER REFERENCES book(id) ON DELETE SET NULL,   -- where it occurs / is described
  told_by_entity_id INTEGER REFERENCES entity(id) ON DELETE SET NULL,

  -- Date. date_precision NULL = undated (no position on the axis).
  date_precision    TEXT CHECK (date_precision IN ('year', 'age', 'relative', 'bucket')),
  year              INTEGER,
  age_id            INTEGER REFERENCES age(id) ON DELETE SET NULL,
  relative_to_event INTEGER REFERENCES event(entity_id) ON DELETE SET NULL,
  offset_years      INTEGER,
  bucket            TEXT,

  sort_key          REAL,                  -- computed by app code on save
  sort_key_override REAL,                  -- manual pin
  manual_order      INTEGER NOT NULL DEFAULT 0,  -- tiebreaker

  CHECK (date_precision IS NOT 'year'     OR year IS NOT NULL),
  CHECK (date_precision IS NOT 'age'      OR age_id IS NOT NULL),
  CHECK (date_precision IS NOT 'relative' OR relative_to_event IS NOT NULL),
  CHECK (date_precision IS NOT 'bucket'   OR bucket IS NOT NULL),
  CHECK (relative_to_event IS NULL OR relative_to_event <> entity_id)
);
CREATE INDEX idx_event_book     ON event(book_id);
CREATE INDEX idx_event_relative ON event(relative_to_event);

CREATE TABLE event_participant (
  id        INTEGER PRIMARY KEY,
  event_id  INTEGER NOT NULL REFERENCES event(entity_id) ON DELETE CASCADE,
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'participant',  -- locations use 'location'
  UNIQUE (event_id, entity_id, role)
);
CREATE INDEX idx_participant_entity ON event_participant(entity_id);

-- ───────────── Links, mentions, buckets ─────────────

CREATE TABLE entity_link (
  id             INTEGER PRIMARY KEY,
  from_entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  to_entity_id   INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,            -- family, ally, rival, member_of, owns, ...
  note           TEXT NOT NULL DEFAULT '',
  start_event_id INTEGER REFERENCES event(entity_id) ON DELETE SET NULL,
  end_event_id   INTEGER REFERENCES event(entity_id) ON DELETE SET NULL,
  CHECK (from_entity_id <> to_entity_id)
);
CREATE INDEX idx_link_from ON entity_link(from_entity_id);
CREATE INDEX idx_link_to   ON entity_link(to_entity_id);

-- Rebuilt by app code from entity.description on save.
CREATE TABLE mention (
  source_entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  target_entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  PRIMARY KEY (source_entity_id, target_entity_id)
) WITHOUT ROWID;
CREATE INDEX idx_mention_target ON mention(target_entity_id);

-- Editable sort values for vague dates, seeded per series.
CREATE TABLE bucket_default (
  series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  bucket    TEXT NOT NULL,                 -- mythic, ancient, distant, recent, present
  label     TEXT NOT NULL,                 -- display, e.g. 'Long ago'
  sort_key  REAL NOT NULL,
  PRIMARY KEY (series_id, bucket)
) WITHOUT ROWID;

-- ───────────── Views ─────────────

CREATE VIEW v_timeline AS
SELECT
  ev.entity_id,
  en.series_id,
  en.name,
  ev.mode,
  ev.book_id,
  b.number                                   AS book_number,
  ev.date_precision,
  ev.year,
  ev.age_id,
  a.name                                     AS age_name,
  ev.relative_to_event,
  ev.offset_years,
  ev.bucket,
  ev.sort_key,
  ev.sort_key_override,
  COALESCE(ev.sort_key_override, ev.sort_key) AS effective_key,
  ev.manual_order
FROM event ev
JOIN entity en  ON en.id = ev.entity_id
LEFT JOIN book b ON b.id = ev.book_id
LEFT JOIN age  a ON a.id = ev.age_id;

-- Graph edge weights: number of shared events per unordered entity pair.
CREATE VIEW v_cooccurrence AS
SELECT
  ea.series_id,
  p1.entity_id                  AS entity_a,
  p2.entity_id                  AS entity_b,
  COUNT(DISTINCT p1.event_id)   AS weight
FROM event_participant p1
JOIN event_participant p2
  ON p2.event_id = p1.event_id AND p1.entity_id < p2.entity_id
JOIN entity ea ON ea.id = p1.entity_id
GROUP BY ea.series_id, p1.entity_id, p2.entity_id;
