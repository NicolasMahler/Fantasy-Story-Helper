<script lang="ts">
  import { rpc } from '../db/client';
  import type { SeriesRow } from '../db/series';
  import { href, type SeriesTab } from './route';
  import EntriesTab from './EntriesTab.svelte';
  import BooksTab from './BooksTab.svelte';
  import TypesTab from './TypesTab.svelte';
  import CalendarTab from './CalendarTab.svelte';
  import TimelineTab from './TimelineTab.svelte';
  import GraphTab from './GraphTab.svelte';
  import { slideIndicator } from './motion';
  import { attempt } from './forms';

  let { seriesId, tab, focus }: { seriesId: number; tab: SeriesTab; focus?: number } = $props();

  let series = $state<SeriesRow | null | undefined>(undefined);
  let loadError = $state<string | null>(null);

  async function load() {
    series = await rpc('getSeries', seriesId);
  }

  const tabs: { id: SeriesTab; label: string }[] = [
    { id: 'entries', label: 'Entries' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'graph', label: 'Graph' },
    { id: 'books', label: 'Books' },
    { id: 'types', label: 'Types' },
    { id: 'calendar', label: 'Calendar' },
  ];

  attempt(load, (m) => (loadError = m));
</script>

{#if loadError}
  <p class="error" role="alert">Couldn't load this series: {loadError}</p>
{:else if series === null}
  <p>This series doesn't exist. <a href="#/">Back to the library</a>.</p>
{:else if series}
  <a class="back" href="#/">← Library</a>
  <h1 class="title">{series.name}</h1>
  {#if series.description}<p class="muted">{series.description}</p>{/if}

  <nav class="tabs" aria-label="Series sections" use:slideIndicator={"[aria-current='page']"}>
    <span class="slide-indicator" aria-hidden="true"></span>
    {#each tabs as t (t.id)}
      <a href={href({ name: 'series', seriesId, tab: t.id })} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
    {/each}
  </nav>

  {#key tab}
    <div class="page-in">
      {#if tab === 'entries'}
        <EntriesTab {seriesId} />
      {:else if tab === 'books'}
        <BooksTab {seriesId} />
      {:else if tab === 'timeline'}
        {#key focus}<TimelineTab {seriesId} {focus} />{/key}
      {:else if tab === 'graph'}
        <GraphTab {seriesId} />
      {:else if tab === 'calendar'}
        <CalendarTab {seriesId} />
      {:else}
        <TypesTab {seriesId} />
      {/if}
    </div>
  {/key}
{/if}

<style>
  .title { margin: 0.25rem 0; }
</style>
