# Relationship graph — design (build step 5)

Approved in conversation 2026-11-19 from `docs/mockups/graph.html`.

## Scope
- **Relationships section** on every entry page: hand-made links (`entity_link`) with a kind (free text with suggestions:
  ally, rival, enemy, family, parent of, child of, sibling, spouse, partners, friends, member of, leads, serves, owns,
  mentor of), the other entry, optional note, optional "from" / "until" events. Listed from both sides; delete with ✕.
- **Graph tab** (after Timeline): nodes = entries coloured by type, sized by connections. Type chips choose which
  types appear (default: character, faction, people, location).
  Edges: grey = shared event participation (thicker = more shared events); gold dashed = hand-made relationships,
  labelled with their kind. "Hide ties under N events" slider, book filter (shared events from that book only),
  relationships on/off. Tap an edge → side panel with the shared events (linking to them) and relationships;
  tap a node → highlight neighbours, panel with link to its page. Drag to pan, wheel/pinch to zoom, drag nodes.
  Panel sits under the graph on phones.
- Dev sample: Book 1 relationships only.

## Decisions (my calls)
- Library: **d3-force** (layout) + **d3-zoom** (pan/zoom), rendered as SVG in Svelte. Cytoscape.js rejected as ~10× larger.
- Nodes with no visible edge are hidden (otherwise every item and lore entry floats alone); a count says how many.
- Turning the Event type on adds event nodes connected to their participants.
- Co-occurrence counts come from `event_participant` only (tellers don't create ties).
- Pure, tested graph building in `src/lib/graphModel.ts`; one `getGraph` DB read.
