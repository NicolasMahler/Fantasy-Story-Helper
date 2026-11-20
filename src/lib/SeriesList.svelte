<script lang="ts">
  import { plural } from './text';
  import { rpc } from '../db/client';
  import type { SeriesRow } from '../db/series';
  import { href } from './route';
  import { backupOverdue, type BackupStatus } from '../db/meta';
  import { timeAgo } from './timeAgo';
  import { attempt } from './forms';

  let series = $state<SeriesRow[]>([]);
  let name = $state('');
  let description = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  let backup = $state<BackupStatus | null>(null);

  async function load() {
    [series, backup] = await Promise.all([rpc('listSeries'), rpc('backupStatus')]);
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

  // Editing a series happens here in the library, one card at a time.
  let editingId = $state<number | null>(null);
  let editName = $state('');
  let editDescription = $state('');
  let editError = $state<string | null>(null);

  function startEdit(s: SeriesRow) {
    editingId = s.id;
    editName = s.name;
    editDescription = s.description;
    editError = null;
  }

  async function save(ev: SubmitEvent) {
    ev.preventDefault();
    if (editingId === null) return;
    const id = editingId;
    await attempt(async () => {
      await rpc('updateSeries', id, { name: editName, description: editDescription });
      editingId = null;
      await load();
    }, (m) => (editError = m));
  }

  async function remove(s: SeriesRow) {
    if (!confirm(`Delete “${s.name}” and everything in it? This can't be undone.`)) return;
    await attempt(async () => {
      await rpc('deleteSeries', s.id);
      editingId = null;
      await load();
    }, (m) => (editError = m));
  }

  load();
</script>

<h1>Library</h1>

{#if backup && backupOverdue(backup)}
  <div class="backup card" role="note">
    <span>💾 {backup.lastExportAt ? `Last backup ${timeAgo(backup.lastExportAt)}.` : "You haven't backed up yet."} Your library lives only in this browser.</span>
    <a class="button" href="#/settings">Back up now</a>
  </div>
{/if}

{#if series.length === 0}
  <p class="muted">No series yet. Add the first one below.</p>
{:else}
  <ul class="list">
    {#each series as s (s.id)}
      <li>
        {#if editingId === s.id}
          <form class="card stack" onsubmit={save}>
            <label>Name <input bind:value={editName} required /></label>
            <label>Description <textarea bind:value={editDescription} rows="2"></textarea></label>
            {#if editError}<p class="error">{editError}</p>{/if}
            <div class="row">
              <button class="primary">Save</button>
              <button type="button" onclick={() => (editingId = null)}>Cancel</button>
              <button type="button" class="danger push" onclick={() => remove(s)}>Delete series</button>
            </div>
          </form>
        {:else}
          <div class="card item">
            <a class="open" href={href({ name: 'series', seriesId: s.id, tab: 'entries' })}><strong>{s.name}</strong></a>
            {#if s.description}<span class="muted">{s.description}</span>{/if}
            <small class="muted">{plural(s.books, 'book')} · {plural(s.entities, 'entry', 'entries')}</small>
            <button class="small edit" onclick={() => startEdit(s)} aria-label={`Edit ${s.name}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4M13.5 6.5l4 4" /></svg>Edit
            </button>
          </div>
        {/if}
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
  .backup { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; border-color: var(--warn-text); background: var(--warn-bg); color: var(--warn-text); margin-bottom: 1rem; }
  /* The whole card opens the series (the link's ::after covers it); Edit sits above that in the corner. */
  .item { position: relative; display: grid; gap: 0.15rem; padding-right: 6rem; }
  .open { color: inherit; text-decoration: none; }
  .open::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
  .open:focus-visible { outline: none; }
  .item:has(.open:focus-visible) { outline: 2px solid var(--accent); outline-offset: 1px; }
  .edit { position: absolute; top: 0.75rem; right: 0.75rem; z-index: 1; }
  .small { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 34px; padding: 0.2rem 0.7rem; font-size: 0.85rem; }
  .small svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .push { margin-left: auto; }
</style>
