<script lang="ts">
  import { db } from '../db/client';

  interface SeriesRow {
    id: number;
    name: string;
    description: string;
    books: number;
    entities: number;
  }

  let series = $state<SeriesRow[]>([]);
  let name = $state('');
  let description = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function load() {
    series = await db.query<SeriesRow>(`
      SELECT s.id, s.name, s.description,
             (SELECT COUNT(*) FROM book b WHERE b.series_id = s.id)   AS books,
             (SELECT COUNT(*) FROM entity e WHERE e.series_id = s.id) AS entities
      FROM series s ORDER BY s.name COLLATE NOCASE`);
  }

  async function create(ev: SubmitEvent) {
    ev.preventDefault();
    busy = true;
    error = null;
    try {
      await db.createSeries({ name, description });
      name = '';
      description = '';
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function remove(s: SeriesRow) {
    if (!confirm(`Delete “${s.name}” and everything in it? This can't be undone.`)) return;
    await db.deleteSeries(s.id);
    await load();
  }

  load();
</script>

<h1>Library</h1>

{#if series.length === 0}
  <p class="muted">No series yet. Add the first one below.</p>
{:else}
  <ul class="list">
    {#each series as s (s.id)}
      <li class="card">
        <div>
          <strong>{s.name}</strong>
          {#if s.description}<p class="muted">{s.description}</p>{/if}
          <small class="muted">{s.books} books · {s.entities} entries</small>
        </div>
        <button class="danger" onclick={() => remove(s)} aria-label={`Delete ${s.name}`}>Delete</button>
      </li>
    {/each}
  </ul>
{/if}

<form class="card" onsubmit={create}>
  <h2>New series</h2>
  <label>Name <input bind:value={name} required placeholder="e.g. The Wheel of Ages" /></label>
  <label>Description <textarea bind:value={description} rows="2"></textarea></label>
  {#if error}<p class="error">{error}</p>{/if}
  <button class="primary" disabled={busy || !name.trim()}>Create series</button>
</form>

<style>
  .list { list-style: none; padding: 0; display: grid; gap: 0.75rem; margin: 0 0 1.5rem; }
  .list li { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .list p { margin: 0.25rem 0; }
  form { display: grid; gap: 0.75rem; }
  form h2 { margin: 0; font-size: 1.1rem; }
  label { display: grid; gap: 0.25rem; font-size: 0.9rem; }
  .error { color: var(--danger); margin: 0; }
</style>
