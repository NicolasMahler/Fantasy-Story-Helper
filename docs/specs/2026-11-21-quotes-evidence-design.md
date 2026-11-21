# Quotes and evidence

## Scope
Keep lines from the books and tie them to entries. On a theory, a quote is evidence for or against it.

## Decisions (my calls)
- **Own table, not an entry type.** Quotes would crowd the Entries list; they belong to an entry instead
  (`quote.entity_id`, cascade on delete). v6 migration.
- **Where:** optional book plus a free-text `chapter` ("Ch. 12", "p. 340", "Prologue"), since books
  number their chapters differently. Listed in reading order: book number (no book last), then chapter
  compared numerically, then when added.
- **Speaker** is an optional entry in the same series (SET NULL on delete). A speaker's page shows
  "Their words": their quotes filed under other entries.
- **Stance** (`for` / `against` / none) is kept only on theories; on other entries it is stored as NULL.
  The theory's Evidence heading shows "N for · M against".
- Quote text is plain text, not `@`-linked: it is what the book says, verbatim.
- **Export/import:** `quote` is a data table; add-mode remaps entry, book and speaker.
- **Search:** quote text and notes match, shown on the entry they are filed under (field "quote").
- New quotes default to the latest book, as theory resolutions do.

## Later
Quote-of-the-book recap, filtering Entries by "has evidence", and chapter positions shared with a spoiler shield.
