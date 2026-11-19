# Data Layer & Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installable offline PWA that opens a persistent on-device SQLite DB, migrates it from `schema.sql`, seeds series defaults, and exports/imports backups.

**Architecture:** All DB logic (migrations, seeding, JSON dump) is written against a tiny `SqlDb` interface so it runs unchanged on sqlite-wasm in a Web Worker (app) and on `node:sqlite` (tests). The main thread talks to the worker via a typed promise RPC.

**Tech Stack:** Svelte 5, TypeScript, Vite, vite-plugin-pwa, @sqlite.org/sqlite-wasm (opfs-sahpool), Vitest + node:sqlite.

**Spec:** `docs/specs/2026-11-18-data-layer-design.md`

## Global Constraints
- `PRAGMA foreign_keys = ON` on every connection open.
- Migration state in `PRAGMA user_version`; each migration in one transaction.
- No server headers required (opfs-sahpool, not the plain OPFS VFS).
- No seed data except per-series defaults.

## Review Focus
1. Reopening an already-migrated DB must not re-run migrations (test: migrate twice → version unchanged, no error).
2. A failing migration must leave the DB at its prior version (test: bad SQL → user_version still 0, no tables).
3. Importing a file that isn't SQLite must be rejected without destroying the current DB (worker validates header `SQLite format 3\0` before replacing).
4. Deleting a series cascades to everything under it (test: delete series → entity/entity_type/bucket_default empty).
5. Built-in `event` type exists exactly once per series and the `@` keys are unique (test: seed → one `event` row with `is_builtin = 1`).

---

### Task 1: Project skeleton
**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `src/main.ts`, `src/App.svelte`, `public/icon-*.png`
- [ ] Install deps; `npm run build` succeeds; `npm test` runs (zero tests OK).

### Task 2: Migrations
**Files:** `src/db/types.ts`, `src/db/schema.sql`, `src/db/migrations.ts`, `tests/helpers/nodeDb.ts`, `tests/migrations.test.ts`
**Interfaces (produces):**
- `interface SqlDb { exec(sql: string, params?: unknown[]): void; query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]; transaction<T>(fn: () => T): T }`
- `MIGRATIONS: string[]`; `migrate(db: SqlDb, migrations = MIGRATIONS): number` returns final version.
- `openNodeDb(): SqlDb` (test helper, in-memory, foreign_keys on).
- [ ] Tests: fresh DB → version 1 and all 10 tables + 2 views exist; second migrate is a no-op; a failing migration rolls back (Review Focus 1, 2).

### Task 3: Series seeding
**Files:** `src/db/seed.ts`, `tests/seed.test.ts`
**Interfaces:** `DEFAULT_ENTITY_TYPES: {key,name,icon,color,is_builtin}[]` (10 keys in handoff order); `DEFAULT_BUCKETS: {bucket,label,sort_key}[]` = mythic −1000000 "In myth", ancient −100000 "In ancient times", distant −10000 "Long ago", recent −100 "Not long ago", present 0 "Present day"; `createSeries(db, {name, description?}) => number`; `deleteSeries(db, id) => void`.
- [ ] Tests: 10 types, exactly one builtin `event`; 5 buckets; cascade delete (Review Focus 4, 5).

### Task 4: JSON dump
**Files:** `src/db/dump.ts`, `tests/dump.test.ts`
**Interfaces:** `dumpJson(db) => { format: 'fantasy-helper', schemaVersion: number, exportedAt: string, tables: Record<string, Record<string, unknown>[]> }` covering every table from `sqlite_schema` where type='table' and name not like 'sqlite_%'.
- [ ] Test: after createSeries, dump has series(1), entity_type(10), bucket_default(5).

### Task 5: Worker + client
**Files:** `src/db/worker.ts`, `src/db/client.ts`, `src/db/protocol.ts`
**Interfaces:** client exports `db.init() => Promise<{persistent: boolean, opfs: boolean, version: number}>`, `db.query`, `db.exec`, `db.createSeries`, `db.deleteSeries`, `db.exportSqlite() => Promise<Uint8Array>`, `db.exportJson()`, `db.importSqlite(bytes) => Promise<void>`.
- Worker: sahpool VFS name `reading-companion`, file `/companion.sqlite3`; on OPFS failure fall back to `:memory:` with `opfs: false`. Import validates the SQLite header (Review Focus 3), closes DB, `pool.importDb`, reopens, migrates.
- [ ] Verified in browser (Task 6).

### Task 6: Shell UI + browser verification
**Files:** `src/App.svelte`, `src/lib/SeriesList.svelte`, `src/lib/Settings.svelte`, `src/lib/download.ts`
- Hash routes `#/` (series list + new form) and `#/settings` (storage status, export .sqlite, export JSON, import .sqlite with confirm). Banner when `opfs: false`.
- [ ] In dev browser: create series → reload → still there; export downloads; import roundtrip works.
