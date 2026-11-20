<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from './Icon.svelte';
  import { rpc } from '../db/client';
  import type { EntityListItem } from '../db/entities';
  import type { EntityTypeRow } from '../db/entityTypes';
  import { href } from './route';
  import { rise } from './motion';
  import { STATUS_LABELS, type TheoryStatus } from '../db/theories';
  import { loadFilter, saveFilter } from './entriesFilter';

  let { seriesId }: { seriesId: number } = $props();

  let types = $state<EntityTypeRow[]>([]);
  let entries = $state<EntityListItem[]>([]);
  // Picks up where the reader left off in this series (see entriesFilter.ts). The tab is re-created
  // for each series (keyed in App), so reading seriesId once is enough.
  const start = untrack(() => loadFilter(seriesId));
  let typeId = $state<number | null>(start.typeId);
  let search = $state(start.search);
  /** Only offered while the Theory type is picked. */
  let theoryStatus = $state<TheoryStatus | null>(start.theoryStatus);
  const theoryType = $derived(types.find((t) => t.key === 'theory'));
  const showingTheories = $derived(theoryType !== undefined && typeId === theoryType.id);
  const THEORY_FILTERS: TheoryStatus[] = ['open', 'confirmed', 'wrong', 'answered'];
  let loaded = $state(false);

  $effect(() => {
    rpc('listTypes', seriesId).then((t) => {
      types = t;
      // A remembered type may have been deleted since.
      if (typeId !== null && !t.some((x) => x.id === typeId)) typeId = null;
    });
  });

  $effect(() => saveFilter(seriesId, { typeId, search, theoryStatus }));

  $effect(() => {
    const filter = { typeId, search, theoryStatus: showingTheories ? theoryStatus : null };
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

{#if showingTheories}
  <div class="chips sub" role="group" aria-label="Filter theories by status">
    <button class="chip" aria-pressed={theoryStatus === null} onclick={() => (theoryStatus = null)}>Any status</button>
    {#each THEORY_FILTERS as s (s)}
      <button class="chip" aria-pressed={theoryStatus === s} onclick={() => (theoryStatus = theoryStatus === s ? null : s)}>
        <span class="sdot s-{s}" aria-hidden="true"></span>{STATUS_LABELS[s]}
      </button>
    {/each}
  </div>
{/if}

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
            {#if e.theory_status}
              <small class="tstatus s-{e.theory_status}">
                <span class="sdot s-{e.theory_status}" aria-hidden="true"></span>{e.theory_status === 'open' ? (e.theory_kind === 'question' ? 'Open question' : 'Open') : STATUS_LABELS[e.theory_status]}
              </small>
            {/if}
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
  .sub { margin-top: -0.1rem; }
  .sub .chip, .tstatus { display: inline-flex; align-items: center; gap: 0.35rem; }
  .tstatus { display: flex; width: fit-content; font-weight: 600; margin-top: 0.1rem; }
  .tstatus.s-open { color: var(--accent); }
  .tstatus.s-confirmed, .tstatus.s-answered { color: var(--ok); }
  .tstatus.s-wrong { color: var(--danger); }
  .sdot { width: 0.55rem; height: 0.55rem; border-radius: 50%; flex: none; }
  .sdot.s-open { border: 2px solid var(--accent); }
  .sdot.s-confirmed, .sdot.s-answered { background: var(--ok); }
  .sdot.s-wrong { background: var(--danger); }
  /* On a highlighted chip the accent fill would hide the open ring, so dots take the chip's text colour. */
  .chip[aria-pressed='true'] .sdot.s-open { border-color: currentColor; }
  .chip[aria-pressed='true'] .sdot:not(.s-open) { box-shadow: 0 0 0 1.5px currentColor; }
  .why { display: block; font-weight: 400; color: var(--muted); overflow-wrap: anywhere; margin-top: 0.1rem; }
</style>
