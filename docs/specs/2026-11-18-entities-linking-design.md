# Entities, books, types & @-linking — design (build step 2)

Approved in conversation 2026-11-18.

## Scope
- Series page with tabs **Entries** (type filter + name search), **Books** (add, rename, reorder, delete), **Types**.
- **Types:** 10 seeded defaults + custom types (name, emoji icon, color, extra fields of kind text | long text | number).
  A type can be deleted only if unused; `event` (builtin) never.
- **Entry page:** name, type, first book, description, extra fields, **Mentioned in** (backlinks). Edit + delete.
- **@-linking:** typing `@` in a description autocompletes across all entries; `@key:` narrows by type key;
  last option **Create "…"** asks for a type (pre-selected from prefix) and creates a stub entry.
- Creating an `event` entry also inserts its bare `event` row (present, undated). Changing an entry's type
  away from event deletes that row (UI confirms). Dates/participants are step 3.

## Decisions (my calls)
- Mention token stored in `entity.description`: `@[Label](id)`. Rendering shows the target's **current** name,
  so renames propagate; a deleted target renders as plain text (the stored label). `]` and newlines are stripped from labels.
- On every create/update, mention rows for that entity are rebuilt from its description, only for targets in the same series.
- Custom type `key` = slug of the name, made unique within the series (`-2`, `-3`…). Keys are immutable after creation
  so `@key:` habits don't break.
- `field_schema` = JSON array of `{ key, label, kind }`; values live in `entity.attributes` by field key.
- Book renumbering keeps numbers contiguous 1..n; reorder = swap with neighbour.
- Ages are deferred to step 3.

## Architecture
Domain functions in `src/db/{series,books,entityTypes,entities,mentions}.ts`, all `(db: SqlDb, ...)`, tested on node:sqlite.
`src/db/api.ts` collects them; the worker exposes the whole object through one generic `api` RPC op, and the client
offers a typed `rpc(name, ...args)`. Hash router in `src/lib/route.ts` (pure, tested).
