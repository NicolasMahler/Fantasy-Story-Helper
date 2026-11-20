<script lang="ts">
  import Icon from './Icon.svelte';
  import type { TimelineEvent } from '../db/timeline';
  import { href } from './route';

  let {
    event,
    seriesId,
    open,
    ontoggle,
    showBook = true,
  }: { event: TimelineEvent; seriesId: number; open: boolean; ontoggle: () => void; showBook?: boolean } = $props();

  const recounted = $derived(event.mode === 'recounted');
  const sub = $derived(
    [
      recounted ? (event.toldBy ? `Told by ${event.toldBy.name}` : 'Recounted') : null,
      showBook && event.bookNumber ? `Bk ${event.bookNumber}` : null,
      event.participants.length ? `${event.participants.length} involved` : null,
      event.pinned ? '📌 pinned' : null,
    ].filter(Boolean).join(' · '),
  );
</script>

<div class="ev" class:rec={recounted}>
  <button class="name" aria-expanded={open} onclick={ontoggle}>{event.name}</button>
  {#if sub}<small>{sub}</small>{/if}
  {#if open}
    <div class="card">
      <div>{event.label}{event.bookNumber ? ` · ${recounted ? 'Described' : 'Happens'} in Book ${event.bookNumber}${event.bookTitle ? `: ${event.bookTitle}` : ''}` : ''}</div>
      {#if event.toldBy}
        <div>Told by <a href={href({ name: 'entity', seriesId, entityId: event.toldBy.id })}>{event.toldBy.name}</a></div>
      {/if}
      {#if event.participants.length}
        <div class="who">
          {#each event.participants as p (`${p.entityId}:${p.role}`)}
            <a href={href({ name: 'entity', seriesId, entityId: p.entityId })}><Icon name={p.icon} size={13} /> {p.name}{p.role !== 'participant' && p.role !== 'location' ? ` · ${p.role}` : ''}</a>
          {/each}
        </div>
      {/if}
      <a class="open" href={href({ name: 'entity', seriesId, entityId: event.id })}>Open event →</a>
    </div>
  {/if}
</div>

<style>
  .ev { padding: 3px 0 6px 4px; min-width: 0; }
  .name {
    all: unset; cursor: pointer; font-weight: 550; font-size: 0.95rem; overflow-wrap: anywhere;
    border-radius: 4px;
  }
  .name:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .rec .name { font-style: italic; color: color-mix(in srgb, var(--text) 85%, var(--muted)); }
  small { display: block; color: var(--muted); font-size: 0.78rem; }
  .card {
    margin: 6px 0 4px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--surface); font-size: 0.85rem; display: grid; gap: 6px;
  }
  .who { display: flex; flex-wrap: wrap; gap: 4px; }
  .who a {
    text-decoration: none; color: var(--text); font-size: 0.8rem; padding: 2px 8px; border-radius: 6px;
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }
  .open { font-weight: 600; text-decoration: none; }
</style>
