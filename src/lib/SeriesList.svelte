<script lang="ts">
  import { rpc } from '../db/client';
  import type { SeriesRow } from '../db/series';
  import { href } from './route';

  let series = $state<SeriesRow[]>([]);
  let name = $state('');
  let description = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function load() {
    series = await rpc('listSeries');
  }

  async function create(ev: SubmitEvent) {
    ev.preventDefault();
    busy = true;
    error = null;
    try {
      const id = await rpc('createSeries', { name, description });
      location.hash = href({ name: 'series', seriesId: id, tab: 'entries' });
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  load();
</script>

<h1>Library</h1>

{#if series.length === 0}
  <p class="muted">No series yet. Add the first one below.</p>
{:else}
  <ul class="list">
    {#each series as s (s.id)}
      <li>
        <a class="card item" href={href({ name: 'series', seriesId: s.id, tab: 'entries' })}>
          <strong>{s.name}</strong>
          {#if s.description}<span class="muted">{s.description}</span>{/if}
          <small class="muted">{s.books} {s.books === 1 ? 'book' : 'books'} · {s.entities} {s.entities === 1 ? 'entry' : 'entries'}</small>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<form class="card stack" onsubmit={create}>
  <h2>New series</h2>
  <label>Name <input bind:value={name} required placeholder="e.g. The Wheel of Ages" /></label>
  <label>Description <textarea bind:value={description} rows="2"></textarea></label>
  {#if error}<p class="error">{error}</p>{/if}
  <div><button class="primary" disabled={busy || !name.trim()}>Create series</button></div>
</form>

<style>
  .item { display: grid; gap: 0.15rem; text-decoration: none; color: inherit; }
  .item:hover { border-color: var(--accent); }
</style>
