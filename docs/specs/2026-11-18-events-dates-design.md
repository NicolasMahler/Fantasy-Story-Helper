# Events, dates & sort keys — design (build step 3)

Approved in conversation 2026-11-18.

## Scope
- **Calendar tab** on the series page: ages (name, start year, optional end year, forward/backward) and the five
  vague-date positions (label + position in years), all editable.
- **Event details** on an event's page: mode (present | recounted), book, told by (recounted only), date
  (undated | year [+ optional age] | age only | relative N years before/after another event | vague bucket),
  advanced pin (`sort_key_override`) and tiebreak (`manual_order`).
- **Participants:** any entry + role. Default role `location` for location-type entries, else `participant`;
  free text with suggestions.
- **Events section** on non-event pages: events the entry takes part in, in story order.
- Dev sample (`src/dev/malazanSample.ts`) extended with ages, dates, participants and a recounted event.

## Sort-key rules (from the handoff)
year+forward age `start + year` · year+backward age `start − year` · year only `year` · age only `start` ·
relative `effective(target) + offset` · bucket `bucket_default.sort_key` · effective = override ?? sort_key.

## Decisions (my calls)
- `computeSortKeys` is a pure function over all events of a series; after any date-affecting change
  (event save, age edit, bucket edit, entry delete/type change) the whole series is recomputed. Cheap at series scale,
  and downstream relatives can never go stale.
- Saving a relative date that would form a cycle is rejected. An event relative to an undated event has no key (null).
- Deleting an event (or changing its type away from Event) that others are dated relative to **freezes** those
  dependents: they become `year` precision at their current position (or undated if they had none), so nothing jumps.
- An age that events use can't be deleted (the error says how many).
- Fields not used by the chosen precision are cleared on save.
- Display: "Year 312, Third Age" · "Year 312" · "Third Age (approx.)" · "5 years after X" / "5 years before X" /
  "Same year as X" · bucket label · "Undated"; a pinned event adds "(pinned)".
