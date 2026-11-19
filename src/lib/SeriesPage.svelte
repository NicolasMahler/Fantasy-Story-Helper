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

  let { seriesId, tab }: { seriesId: number; tab: SeriesTab } = $props();

  let series = $state<SeriesRow | null | undefined>(undefined);
  let editing = $state(false);
  let name = $state('');
  let description = $state('');
  let error = $state<string | null>(null);

  async function load() {
    series = await rpc('getSeries', seriesId);
  }

  function startEdit() {
    if (!series) return;
    name = series.name;
    description = series.description;
    error = null;
    editing = true;
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    try {
      await rpc('updateSeries', seriesId, { name, description });
      editing = false;
      await load();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function remove() {
    if (!series) return;
    if (!confirm(`Delete “${series.name}” and everything in it? This can't be undone.`)) return;
    await rpc('deleteSeries', seriesId);
    location.hash = '#/';
  }

  const tabs: { id: SeriesTab; label: string }[] = [
    { id: 'entries', label: 'Entries' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'graph', label: 'Graph' },
    { id: 'books', label: 'Books' },
    { id: 'types', label: 'Types' },
    { id: 'calendar', label: 'Calendar' },
  ];

  load();
</script>

{#if series === null}
  <p>This series doesn't exist. <a href="#/">Back to the library</a>.</p>
{:else if series}
  <a class="back" href="#/">← Library</a>
  {#if editing}
    <form class="card stack" onsubmit={save}>
      <label>Name <input bind:value={name} required /></label>
      <label>Description <textarea bind:value={description} rows="2"></textarea></label>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="row">
        <button class="primary">Save</button>
        <button type="button" onclick={() => (editing = false)}>Cancel</button>
        <button type="button" class="danger push" onclick={remove}>Delete series</button>
      </div>
    </form>
  {:else}
    <div class="title-row">
      <h1>{series.name}</h1>
      <button class="ghost" onclick={startEdit}>Edit</button>
    </div>
    {#if series.description}<p class="muted">{series.description}</p>{/if}
  {/if}

  <nav class="tabs" aria-label="Series sections">
    {#each tabs as t (t.id)}
      <a href={href({ name: 'series', seriesId, tab: t.id })} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
    {/each}
  </nav>

  {#if tab === 'entries'}
    <EntriesTab {seriesId} />
  {:else if tab === 'books'}
    <BooksTab {seriesId} onchange={load} />
  {:else if tab === 'timeline'}
    <TimelineTab {seriesId} />
  {:else if tab === 'graph'}
    <GraphTab {seriesId} />
  {:else if tab === 'calendar'}
    <CalendarTab {seriesId} />
  {:else}
    <TypesTab {seriesId} />
  {/if}
{/if}

<style>
  .title-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .title-row h1 { margin: 0.25rem 0; }
  .push { margin-left: auto; }
</style>
