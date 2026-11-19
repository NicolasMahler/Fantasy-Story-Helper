# Fantasy Helper

A local-first reading companion for long fantasy series. Installable PWA with on-device SQLite (sqlite-wasm, `opfs-sahpool`).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # schema / migration / seeding tests (node:sqlite)
npm run check    # type-check
npm run build    # production build + service worker
```

## Layout
- `src/db/schema.sql`: schema v1 (migration 001). Never edit a shipped migration; append to `MIGRATIONS` in `src/db/migrations.ts`.
- `src/db/worker.ts`: owns the SQLite connection (OPFS). Only one tab can hold it; other tabs run in memory and show a warning.
- `src/db/client.ts`: promise RPC to the worker. In dev it is also available as `window.db` in the console.
- `src/db/seed.ts`: per-series defaults (entity types, date buckets).
- `docs/specs/`, `docs/plans/`: design and plan documents.

## Status
Steps 1–2 of the handoff build order are done: data layer, export/import, app shell; books, entity types (custom types + fields), entries with `@` linking and backlinks.
Next is step 3: events (present/recounted, participants, dates and sort keys).
