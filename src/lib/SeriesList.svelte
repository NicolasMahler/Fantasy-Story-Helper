<script lang="ts">
  import { plural } from './text';
  import { rpc } from '../db/client';
  import type { SeriesRow } from '../db/series';
  import { href } from './route';
  import { backupOverdue, type BackupStatus } from '../db/meta';
  import { timeAgo } from './timeAgo';

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
        <a class="card item" href={href({ name: 'series', seriesId: s.id, tab: 'entries' })}>
          <strong>{s.name}</strong>
          {#if s.description}<span class="muted">{s.description}</span>{/if}
          <small class="muted">{plural(s.books, 'book')} · {plural(s.entities, 'entry', 'entries')}</small>
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
  .backup { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; border-color: var(--warn-text); background: var(--warn-bg); color: var(--warn-text); margin-bottom: 1rem; }
  .item { display: grid; gap: 0.15rem; text-decoration: none; color: inherit; }
  .item:hover { border-color: var(--accent); }
</style>
