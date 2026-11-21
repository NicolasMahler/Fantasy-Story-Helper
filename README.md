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
All six steps of the handoff build order are done: data layer, export/import, app shell; books, entity types, entries with `@` linking and backlinks; events (present/recounted, told by, participants), ages, vague dates and sort keys; the timeline (story order, reading order, story × reading chart, filters); relationships and the relationship graph; search (/ or Ctrl+K), JSON import (replace or add), per-series export, backup reminders, install prompt.
Since then: theories and open questions, a built-in Theory type with a status (open, confirmed, wrong, answered), the book it was settled in and a note; filter them by status in Entries.
Quotes: lines from the books filed under any entry, with book, chapter or page, who said it and a note. On a theory they are evidence (supports it / against it, with a tally); a speaker's page lists their words filed elsewhere; search finds quote text.
Remaining open idea from the handoff: a per-book notes feature (not in the schema yet).

Dev sample: run `await loadMalazanSample()` in the browser console (dev server only). It is extended after every step.

## Deploying (GitHub Pages)
`.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`
(repository setting: Settings → Pages → Source: **GitHub Actions**). The site is served under `/<repo-name>/`;
the workflow passes that as `BASE_PATH`. To try a sub-path build locally from Git Bash:
`MSYS_NO_PATHCONV=1 BASE_PATH=/fantasy-helper/ npm run build && npx vite preview`.
Each address (localhost, the Pages URL, each device) has its own separate library; move data with Export/Import.
