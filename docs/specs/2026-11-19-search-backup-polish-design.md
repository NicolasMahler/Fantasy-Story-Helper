# Search, backup/restore, mobile polish — design (build step 6)

Approved in conversation 2026-11-19, with the JSON import mode choice added by the user.

## Search
- Quick-search overlay: 🔍 in the header, `/` or Ctrl/⌘+K. Scoped to the current series when inside one,
  otherwise all series.
- Matches entry names, descriptions (with `@` tokens shown as plain names), extra-field values, relationship
  kinds/notes, book titles and age names. Ranked: name starts with query → name contains → other fields.
  Results show a highlighted snippet; ↑/↓ + Enter to open.
- Plain `LIKE` matching (no FTS index): instant at series scale and no schema change.

## Backup / restore
- **JSON export** of everything (existing) or of **one series** (new).
- **JSON import** with a mode the user picks:
  - **Replace everything**: validate format/version, wipe and reload all data in one transaction (deferred
    foreign keys); a bad file leaves data untouched.
  - **Add as new series**: every series in the file is added with fresh ids; `@` mention tokens, relative dates,
    tellers, participants, relationships and mentions are remapped; clashing series names get " (imported)".
- **Last backup** tracking: migration 002 adds `app_meta(key, value)`; every export records `last_export_at`.
  Settings shows it; the Library shows a reminder banner when there is data and no export in 14 days (or ever).
  `app_meta` is not part of JSON dumps.

## Mobile polish
- "Install app" button in Settings (`beforeinstallprompt`), iOS "Share → Add to Home Screen" hint, "Installed" state.
- Series tabs sticky under the header; header search button; safe-area padding; tap targets ≥ 40px.
