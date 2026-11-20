<script lang="ts">
  import type { TimelineEvent } from '../db/timeline';
  import type { AgeInfo } from '../db/dates';
  import { storyLayout } from './timelineLayout';
  import TimelineEventView from './TimelineEvent.svelte';

  let { events, ages, seriesId, focus }: { events: TimelineEvent[]; ages: AgeInfo[]; seriesId: number; focus?: number } = $props();
  // Starts with the focused event open; after that the reader opens and closes events freely.
  // svelte-ignore state_referenced_locally
  let openId = $state<number | null>(focus ?? null);

  const layout = $derived(storyLayout(events, ages));
  const toggle = (id: number) => (openId = openId === id ? null : id);
</script>

<div class="tl">
  {#each layout.lanes as lane, i (i)}
    <div class="band" class:age={lane.ageId !== null}>
      <div class="band-label">{lane.label}</div>
      {#each lane.rows as row, j (j)}
        {#if row.kind === 'event'}
          <div class="row">
            <div class="when">{row.when ?? ''}</div>
            <div class="spine"><span class="dot" class:hollow={row.event.mode === 'recounted'}></span></div>
            <TimelineEventView event={row.event} {seriesId} open={openId === row.event.id} focused={focus === row.event.id} ontoggle={() => toggle(row.event.id)} />
          </div>
        {:else}
          <div class="gap" style:height={`${row.size}px`}>
            <div></div><div class="spine"></div>
            {#if row.label}<div class="gap-lbl">⋮ {row.label}</div>{/if}
          </div>
        {/if}
      {/each}
    </div>
  {/each}

  {#if layout.undated.length}
    <div class="band undated">
      <div class="band-label">Undated</div>
      {#each layout.undated as e (e.id)}
        <div class="row">
          <div class="when">·</div>
          <div class="spine"><span class="dot" class:hollow={e.mode === 'recounted'}></span></div>
          <TimelineEventView event={e} {seriesId} open={openId === e.id} focused={focus === e.id} ontoggle={() => toggle(e.id)} />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tl { --age: var(--accent); --unplaced: var(--muted); }
  .band { margin: 0 0 6px; }
  .band.age {
    background: linear-gradient(90deg, color-mix(in srgb, var(--age) 10%, transparent), transparent 75%);
    border-radius: 8px; padding-bottom: 4px;
  }
  .band-label {
    display: flex; align-items: center; gap: 8px; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase;
    color: var(--muted); padding: 10px 0 4px;
  }
  .band-label::after { content: ''; flex: 1; border-top: 1px solid var(--border); }
  .band.age .band-label { color: var(--age); padding-left: 6px; }
  .band.age .band-label::after { border-top-color: color-mix(in srgb, var(--age) 45%, transparent); }
  .row, .gap { display: grid; grid-template-columns: 64px 18px minmax(0, 1fr); }
  .row { align-items: start; min-height: 30px; }
  .when {
    font-size: 0.74rem; color: var(--muted); text-align: right; padding: 5px 6px 0 0;
    font-variant-numeric: tabular-nums; overflow-wrap: anywhere;
  }
  .spine { position: relative; align-self: stretch; }
  .spine::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; border-left: 2px dotted var(--unplaced); }
  .age .spine::before { border-left: 2px solid var(--age); }
  .undated .spine::before { border-left-style: dashed; opacity: 0.5; }
  .gap .spine::before { border-left-style: dotted; border-left-color: var(--border); }
  .dot {
    position: absolute; left: 3px; top: 8px; width: 12px; height: 12px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 0 3px var(--bg);
  }
  .dot.hollow { background: var(--bg); border: 2px dashed var(--muted); }
  .gap-lbl { font-size: 0.72rem; color: var(--muted); font-style: italic; align-self: center; padding-left: 4px; }
</style>
