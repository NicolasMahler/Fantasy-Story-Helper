# Timeline — design (build step 4)

Approved in conversation 2026-11-18 after comparing mockups in `docs/mockups/`
(vertical, horizontal, and two experimental views). Chosen: **vertical timeline + "Story × reading" chart as an extra view**.

## Timeline tab (series page, after Entries)
View switch: **Story order** (default) · **Reading order** · **Story × reading**.

- **Story order** (`docs/mockups/timeline.html`, left): vertical, time flows down. Consecutive runs of events in the same
  age form a labelled purple band with a solid spine; events in no age sit in **Unplaced** runs (dotted spine).
  **Undated** events last. Gaps between distinct positions grow with log10 of the years between them and are labelled
  ("⋮ ~90,000 years") when ≥ 10 years.
- **Reading order** (`timeline.html`, right): sections per book (no-book last), story order within each book.
- **Story × reading** (`timeline-experiments.html` #3): SVG. x = reading order (book columns, events evenly spaced within
  a book), y = story time on the same log-compressed scale (past at bottom). Present events ride a ridge line;
  recounted events hang below/above, tethered to the ridge in the book where they're told. Undated events are not plotted
  (count shown). Tap a point for its card.
- ● present (solid), ◌ recounted (hollow dashed, italic).
- **Filters** (combine with AND, shown as removable chips): character, location (participant of either kind),
  participant type, book.
- Tapping an event expands a card: date label, book, teller, participants, link to the event page.

## Decisions (my calls)
- An event's lane = its explicit age, else the age whose range contains its position (backward ages count down
  from start), else Unplaced.
- Layout math lives in pure, tested functions (`src/lib/timelineLayout.ts`); the DB provides one `getTimeline` read.
- Dev sample gains Book 2 with a few events (incl. a recounted one, an undated one and a pinned one).
