<script lang="ts">
  import type { TimelineBook, TimelineEvent } from '../db/timeline';
  import { chartLayout } from './timelineLayout';
  import TimelineEventView from './TimelineEvent.svelte';

  let { events, books, seriesId }: { events: TimelineEvent[]; books: TimelineBook[]; seriesId: number } = $props();

  let containerWidth = $state(700);
  let selected = $state<number | null>(null);

  const HEIGHT = 460;
  const columnCount = $derived(Math.max(1, new Set(events.map((e) => e.bookId ?? -1)).size));
  const width = $derived(Math.max(containerWidth, 560, 90 + columnCount * 150));
  const layout = $derived(chartLayout(events, books, { width: width - 16, height: HEIGHT, left: 96, top: 30, bottom: 64 }));
  /** Label side per point: alternate when a neighbour sits at nearly the same height, avoid the top/bottom edges. */
  const labelBelow = $derived.by(() => {
    const out = new Map<number, boolean>();
    let prev: { x: number; y: number; below: boolean } | null = null;
    for (const p of layout.points) {
      let below = p.event.mode === 'recounted' ? p.y < HEIGHT - 110 : p.y < 70;
      if (prev && Math.abs(prev.y - p.y) < 16 && Math.abs(prev.x - p.x) < 130) below = !prev.below;
      out.set(p.event.id, below);
      prev = { x: p.x, y: p.y, below };
    }
    return out;
  });
  const ridgePath = $derived(
    [...layout.ridge].sort((a, b) => a.x - b.x).map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
  );
  const selectedEvent = $derived(events.find((e) => e.id === selected) ?? null);
  const short = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);
</script>

<p class="muted intro">
  Across: where you <strong>read</strong> it. Up: when it <strong>happened</strong>. Events in the story ride the bright ridge;
  recounted ones hang off it on dotted tethers to the book where they're told.
</p>

<div class="scroller" bind:clientWidth={containerWidth}>
  {#if layout.points.length === 0}
    <p class="muted pad">No dated events to plot{events.length ? ' (all matching events are undated)' : ''}.</p>
  {:else}
    <svg {width} height={HEIGHT} role="img" aria-label="Story time against reading order">
      <!-- book columns -->
      {#each layout.columns as c, i (i)}
        {#if i > 0}<line class="col" x1={c.x0} y1={16} x2={c.x0} y2={HEIGHT - 56} />{/if}
        <text class="book" x={(c.x0 + c.x1) / 2} y={HEIGHT - 18}>{c.book ? `Book ${c.book.number}` : 'No book'}</text>
        {#if c.book}<text class="book-title" x={(c.x0 + c.x1) / 2} y={HEIGHT - 5}>{short(c.book.title)}</text>{/if}
      {/each}

      <!-- y ticks -->
      {#each layout.yTicks as t, i (i)}
        <line class="tick" x1={88} y1={t.y} x2={width - 16} y2={t.y} />
        <text class="ytick" x={84} y={t.y + 3.5}>{t.label.length > 15 ? `${t.label.slice(0, 14)}…` : t.label}</text>
      {/each}
      <text class="axis" x={14} y={HEIGHT / 2} transform={`rotate(-90 14 ${HEIGHT / 2})`}>← earlier · story time · later →</text>

      <!-- ridge -->
      {#if layout.ridge.length > 1}<path class="ridge" d={ridgePath} />{/if}

      <!-- tethers -->
      {#each layout.points as p (p.event.id)}
        {#if p.tether}
          <path class="tether" d={`M ${p.tether.x} ${p.tether.y} C ${p.tether.x} ${(p.tether.y + p.y) / 2}, ${p.x} ${(p.tether.y + p.y) / 2}, ${p.x} ${p.y}`} />
          <circle class="pin" cx={p.tether.x} cy={p.tether.y} r="2.5" />
        {/if}
      {/each}

      <!-- points -->
      {#each layout.points as p (p.event.id)}
        {@const r = 5 + Math.min(6, p.event.participants.length * 0.6)}
        {@const below = labelBelow.get(p.event.id)}
        <g
          class="pt"
          class:rec={p.event.mode === 'recounted'}
          class:sel={selected === p.event.id}
          role="button"
          tabindex="0"
          aria-label={`${p.event.name}, ${p.event.label}`}
          onclick={() => (selected = selected === p.event.id ? null : p.event.id)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selected = selected === p.event.id ? null : p.event.id)}
        >
          <circle cx={p.x} cy={p.y} r={r + 8} class="hit" />
          <circle cx={p.x} cy={p.y} {r} class="dot" />
          <text x={p.x} y={below ? p.y + r + 13 : p.y - r - 6}>{short(p.event.name)}</text>
        </g>
      {/each}
    </svg>
  {/if}
</div>

{#if layout.undatedCount}<p class="muted note">{layout.undatedCount} undated {layout.undatedCount === 1 ? 'event is' : 'events are'} not plotted.</p>{/if}

{#if selectedEvent}
  <div class="selected">
    <TimelineEventView event={selectedEvent} {seriesId} open={true} ontoggle={() => (selected = null)} />
  </div>
{/if}

<div class="legend">
  <span><i></i>In the story</span><span><i class="h"></i>Recounted</span><span><i class="l"></i>Told in this book</span><span>Bigger = more involved</span>
</div>

<style>
  .intro { font-size: 0.85rem; margin: 0 0 0.5rem; }
  .scroller { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .pad { padding: 1rem; }
  svg { display: block; }
  text { font-family: inherit; }
  .col { stroke: var(--border); stroke-dasharray: 3 5; }
  .book { fill: var(--text); font-size: 12px; font-weight: 700; text-anchor: middle; }
  .book-title { fill: var(--muted); font-size: 10px; text-anchor: middle; }
  .tick { stroke: var(--border); stroke-opacity: 0.5; }
  .ytick { fill: var(--muted); font-size: 10.5px; text-anchor: end; font-variant-numeric: tabular-nums; }
  .axis { fill: var(--muted); font-size: 10.5px; text-anchor: middle; }
  .ridge {
    fill: none; stroke: var(--accent); stroke-opacity: 0.28; stroke-width: 18; stroke-linecap: round; stroke-linejoin: round;
  }
  .tether { fill: none; stroke: #d9b45a; stroke-width: 1.5; stroke-dasharray: 2 4; opacity: 0.9; }
  .pin { fill: #d9b45a; }
  .pt { cursor: pointer; outline: none; }
  .hit { fill: transparent; }
  .dot { fill: var(--accent); stroke: var(--surface); stroke-width: 3; }
  .rec .dot { fill: var(--surface); stroke: var(--muted); stroke-width: 2; stroke-dasharray: 3 3; }
  .pt text { fill: var(--text); font-size: 11px; text-anchor: middle; pointer-events: none; }
  .rec text { font-style: italic; fill: var(--muted); }
  .sel .dot, .pt:focus-visible .dot { stroke: var(--text); stroke-width: 2.5; stroke-dasharray: none; }
  .note { font-size: 0.8rem; margin: 0.4rem 0 0; }
  .selected { margin-top: 0.5rem; }
  .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.75rem; color: var(--muted); margin-top: 10px; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); margin-right: 5px; vertical-align: -1px; }
  .legend i.h { background: none; border: 2px dashed var(--muted); }
  .legend i.l { width: 18px; height: 0; border-radius: 0; border-top: 2px dotted #d9b45a; background: none; vertical-align: 3px; }
</style>
