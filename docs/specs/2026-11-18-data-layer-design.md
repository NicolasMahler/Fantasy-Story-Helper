# Data layer & project skeleton — design (build step 1)

## Intent
Lay the foundation for the reading companion described in HANDOFF.md: an installable,
local-first PWA whose data lives in an on-device SQLite database, with export from day one
because the browser is the only copy.

## Goals
- App shell that installs as a PWA and runs offline.
- Open a persistent SQLite DB, apply `schema.sql` via versioned migrations, `PRAGMA foreign_keys = ON` on open.
- Request persistent storage (`navigator.storage.persist()`).
- Export: download the raw `.sqlite` file and a JSON dump (all tables).
- Import: restore from a `.sqlite` file (replace current DB, after confirm).
- Series creation helper that seeds default entity types + bucket defaults (rule 1 from the handoff),
  so step 2 starts with it ready.

## Non-goals (this step)
Entity/event UI, `@` linking, sort-key computation, timeline, graph. JSON import (export only for now).

## Approaches
| | Stack | Trade-off |
|---|---|---|
| **A (picked)** | **Svelte 5 + TypeScript + Vite**, `vite-plugin-pwa` | Small bundles, little boilerplate, good for phone; smaller ecosystem than React. |
| B | React + TypeScript + Vite | Biggest ecosystem; heavier and more ceremony for a solo app. |
| C | Plain TypeScript | No framework lock-in; you'd hand-roll reactivity once the UI grows (timeline filters, graph panels). |

Next.js was dropped: its server features are unused in a no-server app.
Storage is as decided in the handoff: **official `@sqlite.org/sqlite-wasm`, `opfs-sahpool` VFS**.

## Design
- **Worker:** sqlite runs in a dedicated Web Worker (`opfs-sahpool` requires one). The main thread talks to it
  through a tiny typed RPC: `exec(sql, params)`, `query(sql, params) → rows`, `transaction(statements)`,
  `exportDb() → Uint8Array`, `importDb(bytes)`.
- **Migrations:** `src/db/migrations/001_init.sql` = `schema.sql`. Tracked with `PRAGMA user_version`;
  each migration runs in a transaction.
- **Fallback:** if OPFS is unavailable (e.g. old browser, some private modes), fall back to an in-memory DB and
  show a clear "data won't be saved" banner rather than failing silently.
- **Seed defaults** (`createSeries`): types character, location, event (builtin), people, faction, item, magic,
  creature, religion, lore, each with icon + color; buckets mythic/ancient/distant/recent/present with
  spaced sort keys (e.g. −1e6, −1e5, −1e4, −100, 0) and labels ("Long ago", …). All editable later.
- **Shell UI:** minimal: list of series, "New series" form, Settings page with Export/Import and storage status.
- **Tests:** Vitest against the same SQL using Node's built-in `node:sqlite` for schema/seed/migration logic.

## Schema notes (my calls while rebuilding schema.sql)
- `date_precision` NULL = undated event (no axis position).
- `bucket_default` is per series (seeded on series creation).
- `entity_type.key` is the slug used for `@item:`-style prefixes; `is_builtin` blocks deletion of `event`.
- `mention` is a set of (source, target) pairs, with no positions.
- CHECK constraints enforce the date fields that each precision requires.

## Left to the builder
File layout, styling, icon set, exact bucket numbers.
