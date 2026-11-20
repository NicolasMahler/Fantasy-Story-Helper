<script lang="ts">
  import Icon from './Icon.svelte';
  import { rpc } from '../db/client';
  import type { EntityListItem } from '../db/entities';
  import type { EntityTypeRow } from '../db/entityTypes';
  import { href } from './route';
  import { rise } from './motion';

  let { seriesId }: { seriesId: number } = $props();

  let types = $state<EntityTypeRow[]>([]);
  let entries = $state<EntityListItem[]>([]);
  let typeId = $state<number | null>(null);
  let search = $state('');
  let loaded = $state(false);

  $effect(() => {
    rpc('listTypes', seriesId).then((t) => (types = t));
  });

  $effect(() => {
    const filter = { typeId, search };
    rpc('listEntities', seriesId, filter).then((e) => {
      entries = e;
      loaded = true;
    });
  });
</script>

<div class="toolbar">
  <input type="search" placeholder="Search entries" bind:value={search} aria-label="Search entries" />
  <a class="button primary" href={href({ name: 'newEntity', seriesId, typeId })}>New entry</a>
</div>

<div class="chips" role="group" aria-label="Filter by type">
  <button class="chip" aria-pressed={typeId === null} onclick={() => (typeId = null)}>All</button>
  {#each types as t (t.id)}
    <button class="chip" aria-pressed={typeId === t.id} onclick={() => (typeId = typeId === t.id ? null : t.id)}>
      <Icon name={t.icon} size={15} color={t.color} /> {t.name} <small>{t.usage}</small>
    </button>
  {/each}
</div>

{#if loaded && entries.length === 0}
  <p class="muted">
    {search || typeId ? 'No entries match.' : 'No entries yet. Create one, or type @ in any description to create entries as you go.'}
  </p>
{:else}
  <ul class="list compact">
    {#each entries as e, i (e.id)}
      <li in:rise={{ index: i }}>
        <a class="entry" href={href({ name: 'entity', seriesId, entityId: e.id })}>
          <span class="dot" style:background={e.color} aria-hidden="true"></span>
          <span class="icon"><Icon name={e.icon} size={17} color={e.color} /></span>
          <span class="name">
            {e.name}
            {#if e.alias}<small class="aka">aka {e.alias}</small>{/if}
            {#if e.snippet}<small class="why">{e.snippet}</small>{/if}
          </span>
          <small class="muted">{e.type_name}{e.first_book_number ? ` · Book ${e.first_book_number}` : ''}</small>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  .toolbar input { flex: 1; }
  .entry {
    display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem;
    border-radius: var(--radius); text-decoration: none; color: inherit; min-height: 44px;
  }
  .entry:hover { background: var(--surface); }
  .dot { width: 4px; align-self: stretch; border-radius: 2px; }
  .name { flex: 1; min-width: 0; font-weight: 500; }
  .aka { font-weight: 400; margin-left: 0.25rem; }
  /* The excerpt wraps under the name; long words break rather than widen the page. */
  .why { display: block; font-weight: 400; color: var(--muted); overflow-wrap: anywhere; margin-top: 0.1rem; }
</style>
