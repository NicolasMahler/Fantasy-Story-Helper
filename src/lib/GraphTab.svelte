<script lang="ts">
  import Icon from './Icon.svelte';
  import { plural } from './text';
  import { onDestroy } from 'svelte';
  import {
    forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY,
    type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
  } from 'd3-force';
  import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
  import { select } from 'd3-selection';
  import { rpc } from '../db/client';
  import type { GraphData } from '../db/graph';
  import { buildGraph, type ModelEdge, type ModelNode } from './graphModel';
  import { href } from './route';
  import { reducedMotion } from './motion';
  import { ICONS, isIconName } from './icons';

  let { seriesId }: { seriesId: number } = $props();

  const DEFAULT_TYPES = ['character', 'faction', 'people', 'location'];

  let data = $state<GraphData | null>(null);
  let typeIds = $state<number[]>([]);
  let bookId = $state<number | null>(null);
  let minShared = $state(1);
  let showLinks = $state(true);
  let selected = $state<{ kind: 'node'; id: number } | { kind: 'edge'; key: string } | null>(null);
  let width = $state(700);
  /** Fills the column; tall enough to spread out, short enough to leave the details panel in reach. */
  const height = $derived(Math.round(Math.min(680, Math.max(420, width * 0.85))));

  let loadError = $state<string | null>(null);

  $effect(() => {
    rpc('getGraph', seriesId).then(
      (d) => {
        data = d;
        typeIds = d.types.filter((t) => DEFAULT_TYPES.includes(t.key)).map((t) => t.id);
      },
      (e: Error) => (loadError = `Couldn't load the graph: ${e.message}`),
    );
  });

  const model = $derived(data ? buildGraph(data, { typeIds, bookId, minShared, showLinks }) : null);
  const nodeById = $derived(new Map((model?.nodes ?? []).map((n) => [n.id, n])));
  const radius = (n: ModelNode) => 9 + Math.min(12, n.degree * 1.4);

  // ---------- force layout ----------
  type SimNode = SimulationNodeDatum & { id: number; r: number };
  type SimLink = SimulationLinkDatum<SimNode> & { weight: number };
  let sim: Simulation<SimNode, SimLink> | null = null;
  let simNodes: SimNode[] = [];
  let pos = $state(new Map<number, { x: number; y: number }>());
  const remembered = new Map<number, { x: number; y: number }>();

  const publish = () => {
    pos = new Map(simNodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
    for (const n of simNodes) remembered.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  };

  $effect(() => {
    if (!model) return;
    const w = width;
    const h = height;
    sim?.stop();
    simNodes = model.nodes.map((n) => {
      const prev = remembered.get(n.id);
      return { id: n.id, r: radius(n), x: prev?.x ?? w / 2 + (Math.random() - 0.5) * w * 0.6, y: prev?.y ?? h / 2 + (Math.random() - 0.5) * h * 0.6 };
    });
    const links: SimLink[] = model.edges.map((e) => ({ source: e.a, target: e.b, weight: e.shared.length + e.links.length }));
    sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force('link', forceLink<SimNode, SimLink>(links).id((d) => d.id).distance((l) => 120 - Math.min(50, l.weight * 12)).strength(0.25))
      .force('charge', forceManyBody<SimNode>().strength(-320))
      .force('center', forceCenter(w / 2, h / 2))
      .force('x', forceX<SimNode>(w / 2).strength(0.04))
      .force('y', forceY<SimNode>(h / 2).strength(0.06))
      .force('collide', forceCollide<SimNode>().radius((d) => d.r + 22))
      .stop();
    sim.tick(simNodes.every((n) => remembered.has(n.id)) ? 30 : 300);
    publish();
    sim.on('tick', publish);
    queueMicrotask(fit);
  });

  onDestroy(() => sim?.stop());

  // ---------- pan / zoom ----------
  let svgEl = $state<SVGSVGElement | null>(null);
  let transform = $state<ZoomTransform>(zoomIdentity);
  let zoomer: ZoomBehavior<SVGSVGElement, unknown> | null = null;

  $effect(() => {
    if (!svgEl) return;
    zoomer = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((ev: Event) => !(ev.target as Element).closest('.node') && !(ev as MouseEvent).button)
      .on('zoom', (ev) => (transform = ev.transform));
    select(svgEl).call(zoomer).on('dblclick.zoom', null);
  });

  function fit() {
    if (!svgEl || !zoomer || !simNodes.length) return;
    const xs = simNodes.map((n) => n.x ?? 0);
    const ys = simNodes.map((n) => n.y ?? 0);
    const pad = 60;
    const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
    const k = Math.min(2, width / (x1 - x0), height / (y1 - y0));
    const t = zoomIdentity.translate(width / 2 - (k * (x0 + x1)) / 2, height / 2 - (k * (y0 + y1)) / 2).scale(k);
    select(svgEl).call(zoomer.transform, t);
  }
  const zoomBy = (f: number) => svgEl && zoomer && select(svgEl).call(zoomer.scaleBy, f);

  // ---------- node drag / click ----------
  /** `node` is looked up once on pointerdown so moves don't search the node list. */
  let drag: { id: number; node: SimNode | undefined; startX: number; startY: number; moved: boolean } | null = null;

  function toSim(ev: PointerEvent) {
    const rect = svgEl!.getBoundingClientRect();
    return transform.invert([ev.clientX - rect.left, ev.clientY - rect.top]);
  }

  function onNodeDown(ev: PointerEvent, id: number) {
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    drag = { id, node: simNodes.find((s) => s.id === id), startX: ev.clientX, startY: ev.clientY, moved: false };
  }
  function onNodeMove(ev: PointerEvent) {
    if (!drag || !sim) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 4) return;
    drag.moved = true;
    const n = drag.node;
    if (!n) return;
    [n.fx, n.fy] = toSim(ev);
    sim.alphaTarget(0.25).restart();
  }
  function onNodeUp() {
    if (!drag) return;
    const n = drag.node;
    if (n) { n.fx = null; n.fy = null; }
    sim?.alphaTarget(0);
    if (!drag.moved) selected = selected?.kind === 'node' && selected.id === drag.id ? null : { kind: 'node', id: drag.id };
    drag = null;
  }

  // ---------- selection helpers ----------
  const neighbours = $derived.by(() => {
    if (selected?.kind !== 'node' || !model) return null;
    const id = selected.id;
    const set = new Set<number>([id]);
    for (const e of model.edges) if (e.a === id || e.b === id) { set.add(e.a); set.add(e.b); }
    return set;
  });
  const selectedEdge = $derived.by(() => {
    const s = selected;
    return s?.kind === 'edge' ? (model?.edges.find((e) => e.key === s.key) ?? null) : null;
  });
  const selectedNode = $derived(selected?.kind === 'node' ? nodeById.get(selected.id) ?? null : null);
  const nodeEdges = $derived(
    selectedNode && model
      ? model.edges.filter((e) => e.a === selectedNode.id || e.b === selectedNode.id)
          .map((e) => ({ edge: e, other: nodeById.get(e.a === selectedNode.id ? e.b : e.a)! }))
          .sort((x, y) => y.edge.shared.length - x.edge.shared.length || x.other.name.localeCompare(y.other.name))
      : [],
  );

  /** With a node selected, dim edges not touching it; with an edge selected, dim the others. */
  const dim = (e: ModelEdge) => {
    const id = selected?.kind === 'node' ? selected.id : null;
    if (id !== null) return e.a !== id && e.b !== id;
    return !!selectedEdge && selectedEdge.key !== e.key;
  };

  function curve(e: ModelEdge) {
    const p = pos.get(e.a), q = pos.get(e.b);
    if (!p || !q) return '';
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    const off = e.shared.length ? 18 : 0; // bend relationship lines away from the shared-event line
    return `M ${p.x} ${p.y} Q ${mx - (dy / len) * off} ${my + (dx / len) * off} ${q.x} ${q.y}`;
  }
  function labelPos(e: ModelEdge) {
    const p = pos.get(e.a)!, q = pos.get(e.b)!;
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    const off = e.shared.length ? 9 : 0;
    return { x: (p.x + q.x) / 2 - (dy / len) * off, y: (p.y + q.y) / 2 + (dx / len) * off - 3 };
  }

  // The details panel sits under the graph. When a selection leaves its heading off-screen, scroll just
  // enough to show the top of it, so part of the graph stays in view for the next tap.
  let panelEl = $state<HTMLElement | null>(null);
  $effect(() => {
    if (!selected || !panelEl) return;
    const top = panelEl.getBoundingClientRect().top;
    if (top > innerHeight - 80) scrollBy({ top: top - innerHeight * 0.55, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });

  const toggleType = (id: number) =>
    (typeIds = typeIds.includes(id) ? typeIds.filter((t) => t !== id) : [...typeIds, id]);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (selected = null)} />

{#if data && model}
  <div class="controls">
    <div class="chips" role="group" aria-label="Types shown">
      {#each data.types as t (t.id)}
        <button class="chip" style:--c={t.color} aria-pressed={typeIds.includes(t.id)} onclick={() => toggleType(t.id)}><Icon name={t.icon} size={14} color={t.color} /> {t.name}</button>
      {/each}
    </div>
    <div class="row opts">
      {#if data.books.length > 1}
        <select aria-label="Only events from book" bind:value={bookId}>
          <option value={null}>All books</option>
          {#each data.books as b (b.id)}<option value={b.id}>Book {b.number}: {b.title}</option>{/each}
        </select>
      {/if}
      <label class="slider">Hide ties under
        <input type="range" min="1" max="5" bind:value={minShared} aria-label="Minimum shared events" />
        <span>{plural(minShared, 'event')}</span>
      </label>
      <label class="check"><input type="checkbox" bind:checked={showLinks} /> Relationships</label>
    </div>
  </div>

  <div class="layout">
    <div class="canvas" bind:clientWidth={width}>
      {#if model.nodes.length === 0}
        <p class="muted empty">
          Nothing to connect yet. Add participants to events or relationships between entries{typeIds.length ? '' : ', and pick at least one type above'}.
        </p>
      {:else}
        <!-- Clicking empty space clears the selection; keyboard users press Escape (see window handler). -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <svg bind:this={svgEl} {width} {height} role="img" aria-label="Relationship graph" onclick={(e) => { if (e.target === svgEl) selected = null; }}>
          <g transform={transform.toString()}>
            {#each model.edges as e (e.key)}
              {@const p = pos.get(e.a)}
              {@const q = pos.get(e.b)}
              {#if p && q}
                <g class="edge" class:dim={dim(e)} class:sel={selectedEdge?.key === e.key}>
                  {#if e.shared.length}
                    <line class="co" x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke-width={1.2 + Math.min(6, (e.shared.length - 1) * 1.6 + 0.6)} />
                  {/if}
                  {#if e.links.length}
                    <path class="rel" d={curve(e)} />
                    {@const lp = labelPos(e)}
                    <text class="rel-label" x={lp.x} y={lp.y}>{e.links.map((l) => l.kind).join(', ')}</text>
                  {/if}
                  <line
                    class="hit" x1={p.x} y1={p.y} x2={q.x} y2={q.y} role="button" tabindex="-1"
                    aria-label={`${nodeById.get(e.a)?.name} and ${nodeById.get(e.b)?.name}`}
                    onclick={(ev) => { ev.stopPropagation(); selected = selectedEdge?.key === e.key ? null : { kind: 'edge', key: e.key }; }}
                    onkeydown={() => {}}
                  />
                </g>
              {/if}
            {/each}
            {#each model.nodes as n (n.id)}
              {@const p = pos.get(n.id)}
              {#if p}
                {@const r = radius(n)}
                <g
                  class="node" class:dim={neighbours && !neighbours.has(n.id)} class:sel={selected?.kind === 'node' && selected.id === n.id}
                  transform={`translate(${p.x} ${p.y})`} role="button" tabindex="0" aria-label={n.name}
                  onpointerdown={(ev) => onNodeDown(ev, n.id)} onpointermove={onNodeMove} onpointerup={onNodeUp}
                  onkeydown={(ev) => ev.key === 'Enter' && (selected = { kind: 'node', id: n.id })}
                >
                  <circle r={r} fill={n.color} />
                  {#if isIconName(n.icon)}
                    {@const s = Math.max(10, r * 1.05)}
                    <svg class="icon" x={-s / 2} y={-s / 2} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{@html ICONS[n.icon]}</svg>
                  {:else}
                    <text class="icon" y={r * 0.35} font-size={Math.max(10, r * 0.9)}>{n.icon}</text>
                  {/if}
                  <text class="name" y={r + 13}>{n.name}</text>
                </g>
              {/if}
            {/each}
          </g>
        </svg>
        <div class="zoom">
          <button aria-label="Zoom out" onclick={() => zoomBy(0.75)}>⊖</button>
          <button aria-label="Zoom in" onclick={() => zoomBy(1.33)}>⊕</button>
          <button aria-label="Fit to screen" onclick={fit}>⤢</button>
        </div>
      {/if}
    </div>

    <div class="legend">
      <span><i class="l1"></i>1 shared event</span><span><i class="l3"></i>more shared events</span>
      <span><i class="lr"></i>Relationship you added</span><span>Bigger dot = more connections</span>
    </div>

    <aside class="panel" aria-live="polite" bind:this={panelEl}>
      {#if selectedEdge}
        {@const a = nodeById.get(selectedEdge.a)!}
        {@const b = nodeById.get(selectedEdge.b)!}
        <h3><Icon name={a.icon} size={16} color={a.color} /> {a.name} ↔ <Icon name={b.icon} size={16} color={b.color} /> {b.name}</h3>
        <p class="sub">
          {plural(selectedEdge.shared.length, 'shared event')}{bookId ? ' in this book' : ''}
          · {selectedEdge.links.length ? plural(selectedEdge.links.length, 'relationship') : 'no hand-made relationship'}
        </p>
        {#each selectedEdge.links as l (l.id)}
          <div class="relline">{nodeById.get(l.from)?.name} <b>{l.kind}</b> {nodeById.get(l.to)?.name}</div>
        {/each}
        {#if selectedEdge.shared.length}
          <ul>
            {#each selectedEdge.shared as ev (ev.id)}
              <li>
                <span class="marker">{ev.mode === 'present' ? '●' : '◌'}</span>
                <span><a href={href({ name: 'entity', seriesId, entityId: ev.id })}>{ev.name}</a><br /><small>{ev.label}{ev.bookNumber ? ` · Bk ${ev.bookNumber}` : ''}</small></span>
              </li>
            {/each}
          </ul>
        {/if}
        <a class="action" href={href({ name: 'entity', seriesId, entityId: a.id })}>+ Add a relationship (on {a.name}'s page)</a>
      {:else if selectedNode}
        <h3><Icon name={selectedNode.icon} size={16} color={selectedNode.color} /> {selectedNode.name}</h3>
        <p class="sub">{plural(selectedNode.degree, 'connection')}</p>
        <ul>
          {#each nodeEdges as { edge, other } (edge.key)}
            <li>
              <button class="linkish" onclick={() => (selected = { kind: 'edge', key: edge.key })}><Icon name={other.icon} size={14} color={other.color} /> {other.name}</button>
              <small>{[edge.shared.length ? `${edge.shared.length} shared` : '', ...edge.links.map((l) => l.kind)].filter(Boolean).join(' · ')}</small>
            </li>
          {/each}
        </ul>
        <a class="action" href={href({ name: 'entity', seriesId, entityId: selectedNode.id })}>Open {selectedNode.name} →</a>
      {:else}
        <p class="sub">Tap a line to see why two entries are connected, or a dot to highlight its neighbours. Drag to pan, scroll or pinch to zoom, drag dots to rearrange.</p>
        {#if model.hiddenCount}<p class="sub">{model.hiddenCount} {model.hiddenCount === 1 ? 'entry has' : 'entries have'} no connections and {model.hiddenCount === 1 ? 'is' : 'are'} hidden.</p>{/if}
      {/if}
    </aside>
  </div>
{:else}
  <p class="muted">{loadError ?? 'Loading graph…'}</p>
{/if}

<style>
  .controls { display: grid; gap: 8px; margin-bottom: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 12px 10px; margin-bottom: 0; }
  .chip { border-radius: 999px; padding: 0.25rem 0.9rem; min-height: 36px; font-size: 0.82rem; color: var(--muted); }
  .chip[aria-pressed='true'] { border-color: var(--c); color: var(--text); background: color-mix(in srgb, var(--c) 18%, transparent); }
  .opts { gap: 12px; font-size: 0.85rem; color: var(--muted); }
  .opts select { min-height: 34px; padding: 0.2rem 0.5rem; font-size: 0.85rem; }
  .slider { display: flex !important; align-items: center; gap: 8px; }
  .slider input { width: 7rem; padding: 0; accent-color: var(--accent); }
  .check { display: flex !important; align-items: center; gap: 6px; }
  .check input { width: auto; }

  /* Graph spans the column; legend and details stack underneath. */
  .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .canvas {
    position: relative; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; min-height: 200px;
    background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--bg) 75%);
  }
  .empty { padding: 1rem; }
  svg { display: block; touch-action: none; cursor: grab; user-select: none; }
  svg text { font-family: inherit; }
  .co { stroke: color-mix(in srgb, var(--muted) 75%, var(--accent)); stroke-opacity: 0.55; stroke-linecap: round; }
  .rel { fill: none; stroke: #d9b45a; stroke-width: 2; stroke-dasharray: 5 4; }
  .rel-label { fill: #d9b45a; font-size: 10px; text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; }
  .hit { stroke: transparent; stroke-width: 14; cursor: pointer; }
  .edge.sel .co { stroke: var(--text); stroke-opacity: 0.95; }
  .edge.sel .rel { stroke-width: 3; }
  .edge.dim { opacity: 0.12; }
  .node { cursor: pointer; outline: none; }
  .node circle { stroke: var(--bg); stroke-width: 2.5; }
  .node.sel circle { stroke: var(--text); stroke-width: 3; }
  .node.dim { opacity: 0.2; }
  .node .icon { text-anchor: middle; pointer-events: none; }
  .node svg.icon { stroke: var(--bg); overflow: visible; }
  .node .name {
    fill: var(--text); font-size: 11px; text-anchor: middle; pointer-events: none;
    paint-order: stroke; stroke: var(--bg); stroke-width: 3px;
  }
  .node:focus-visible circle { stroke: var(--accent); stroke-width: 3; }
  .zoom { position: absolute; right: 8px; bottom: 8px; display: flex; gap: 4px; }
  .zoom button { min-height: 32px; width: 34px; padding: 0; background: var(--surface); }

  .panel {
    border-radius: calc(var(--radius) + 2px); background: var(--surface); box-shadow: var(--raised); padding: 12px 14px;
    font-size: 0.88rem; display: grid; gap: 8px;
  }
  .panel h3 { margin: 0; font-size: 1rem; overflow-wrap: anywhere; }
  .sub { color: var(--muted); font-size: 0.82rem; margin: 0; }
  .panel ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .panel li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .panel small { color: var(--muted); }
  .marker { color: var(--accent); }
  .relline { border-left: 3px solid #d9b45a; padding-left: 8px; }
  .action { font-weight: 600; text-decoration: none; }
  .linkish { all: unset; cursor: pointer; color: var(--accent); }
  .linkish:focus-visible { outline: 2px solid var(--accent); }

  .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.75rem; color: var(--muted); }
  .legend i { display: inline-block; vertical-align: 3px; margin-right: 5px; width: 22px; }
  .l1 { border-top: 1.5px solid var(--muted); }
  .l3 { border-top: 5px solid var(--muted); }
  .lr { border-top: 2px dashed #d9b45a; }
</style>
