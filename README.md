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
Steps 1–5 of the handoff build order are done: data layer, export/import, app shell; books, entity types, entries with `@` linking and backlinks; events (present/recounted, told by, participants), ages, vague dates and sort keys; the timeline (story order, reading order, story × reading chart, filters); relationships and the relationship graph.
Next is step 6: search, mobile polish, backup/restore.

Dev sample: run `await loadMalazanSample()` in the browser console (dev server only). It is extended after every step.
