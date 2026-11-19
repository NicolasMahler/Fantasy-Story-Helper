<script lang="ts">
  import type { TimelineBook, TimelineEvent } from '../db/timeline';
  import { readingLayout } from './timelineLayout';
  import TimelineEventView from './TimelineEvent.svelte';

  let {
    events, books, seriesId, filtered,
  }: { events: TimelineEvent[]; books: TimelineBook[]; seriesId: number; filtered: boolean } = $props();
  let openId = $state<number | null>(null);

  const sections = $derived(readingLayout(events, books));
</script>

{#each sections as s (s.book?.id ?? 'none')}
  <section>
    <h3>{s.book ? `Book ${s.book.number}` : 'No book'} {#if s.book}<span>{s.book.title}</span>{/if}</h3>
    {#if s.events.length === 0}
      <p class="muted empty">{filtered ? 'No matching events in this book.' : 'No events in this book yet.'}</p>
    {/if}
    {#each s.events as e (e.id)}
      <div class="row">
        <div class="when">{e.short}</div>
        <div class="spine" class:age={e.laneAgeId !== null}><span class="dot" class:hollow={e.mode === 'recounted'}></span></div>
        <TimelineEventView event={e} {seriesId} showBook={false} open={openId === e.id} ontoggle={() => (openId = openId === e.id ? null : e.id)} />
      </div>
    {/each}
  </section>
{/each}

<style>
  section { margin-bottom: 0.75rem; }
  h3 { font-size: 0.9rem; margin: 1rem 0 0.35rem; }
  h3 span { color: var(--muted); font-weight: 400; margin-left: 0.4rem; }
  .empty { margin: 0 0 0 82px; font-size: 0.85rem; }
  .row { display: grid; grid-template-columns: 64px 18px minmax(0, 1fr); align-items: start; min-height: 30px; }
  .when { font-size: 0.74rem; color: var(--muted); text-align: right; padding: 5px 6px 0 0; overflow-wrap: anywhere; }
  .spine { position: relative; align-self: stretch; }
  .spine::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; border-left: 2px dotted var(--muted); }
  .spine.age::before { border-left: 2px solid var(--accent); }
  .dot {
    position: absolute; left: 3px; top: 8px; width: 12px; height: 12px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 0 3px var(--bg);
  }
  .dot.hollow { background: var(--bg); border: 2px dashed var(--muted); }
</style>
